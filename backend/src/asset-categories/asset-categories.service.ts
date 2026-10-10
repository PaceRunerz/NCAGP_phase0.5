// ─────────────────────────────────────────────────────────────────
// SYNC — Asset Category Service
// A proper table instead of a locked enum, so new categories can be
// added — by NIC Admin (system-wide) or any Dept CISO (their own custom
// category, still visible to everyone since categories aren't org-scoped
// — a category is just a classification concept, not department data) —
// without ever needing a schema migration again.
// File: src/asset-categories/asset-categories.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORY_TAXONOMY, FORCED_FRAMEWORK_TRIGGERS } from './category-taxonomy.config';
import { FIELD_GROUPS, resolveFieldsForGroups, FieldDef } from './field-groups.config';

@Injectable()
export class AssetCategoriesService {
  constructor(private prisma: PrismaService) {}

  async list(includeInactive = false) {
    return this.prisma.assetCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ taxonomyGroup: 'asc' }, { isTangible: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Idempotent seed of the full Section 2 taxonomy (~40 categories). Safe
   * to call on every boot — upserts by code, never overwrites an
   * isActive=false category someone deliberately disabled, and never
   * touches fieldTemplate custom-field data admins may have added.
   */
  async seedTaxonomy() {
    let created = 0;
    let updated = 0;
    for (const entry of CATEGORY_TAXONOMY) {
      const existing = await this.prisma.assetCategory.findUnique({ where: { code: entry.code } });
      if (existing) {
        await this.prisma.assetCategory.update({
          where: { code: entry.code },
          data: {
            name: entry.name,
            isTangible: entry.isTangible,
            fieldGroups: entry.fieldGroups,
            taxonomyGroup: entry.groupCode,
            suggestedFrameworks: entry.suggestedFrameworks,
          },
        });
        updated++;
      } else {
        await this.prisma.assetCategory.create({
          data: {
            code: entry.code,
            name: entry.name,
            isTangible: entry.isTangible,
            fieldGroups: entry.fieldGroups,
            taxonomyGroup: entry.groupCode,
            suggestedFrameworks: entry.suggestedFrameworks,
          },
        });
        created++;
      }
    }
    return { created, updated, total: CATEGORY_TAXONOMY.length };
  }

  /** All Field Group definitions, for the frontend to render dynamic forms. */
  listFieldGroups() {
    return Object.values(FIELD_GROUPS);
  }

  /**
   * Resolved, deduplicated field list for one category — merges every
   * Field Group it declares (Section 3), plus any custom fields NIC
   * Admin has promoted to a real structured field for this category
   * (Section 4, tier 2) — a repeated custom field becomes a first-class
   * field going forward without a code deploy.
   */
  async getResolvedFields(categoryId: string): Promise<{ category: any; fields: FieldDef[] }> {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id: categoryId },
      include: { customFieldTemplates: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    const rawGroupFields = resolveFieldsForGroups(category.fieldGroups?.length ? category.fieldGroups : []);
    // Criticality, Data Sensitivity, Department (businessUnit), Status,
    // Description, Tags, and Custodian Department are all part of the
    // fixed universal section every registration form shows regardless
    // of category — GROUP_9_UNIVERSAL also declares them for category
    // taxonomy/matrix purposes, but we don't want them rendered twice
    // in the same form. Exclude them here, once, for every consumer of
    // this endpoint (registration form, bulk-import template, etc).
    const UNIVERSAL_ALREADY_SHOWN = new Set([
      'criticality', 'dataSensitivity', 'businessUnit', 'description', 'tags', 'status', 'custodianOrgId',
      // Model / IP / MAC Address are now fixed, always-visible, compulsory
      // fields at the top of every asset registration card — they must
      // not also appear inside the category-specific "Details" section.
      'model', 'ipAddress', 'macAddress',
    ]);
    const groupFields = rawGroupFields.filter((f) => !UNIVERSAL_ALREADY_SHOWN.has(f.key));
    const promotedFields: FieldDef[] = category.customFieldTemplates.map((t) => ({
      key: t.key,
      label: t.label,
      type: t.fieldType as FieldDef['type'],
    }));
    const seen = new Set(groupFields.map((f) => f.key));
    const merged = [...groupFields, ...promotedFields.filter((f) => !seen.has(f.key))];
    return { category, fields: merged };
  }

  // ── Custom Category Requests (Section 2) ──────────────────────────
  // "Custom" always stays available, but every use logs a request so
  // NIC Admin can see real, repeated demand and turn it into a proper
  // taxonomy category instead of letting freeform noise accumulate.
  async requestCustomCategory(dto: { orgId: string; requestedById: string; requestedName: string; notes?: string }) {
    return this.prisma.categoryRequest.create({ data: dto });
  }

  async listCustomCategoryRequests(status?: string) {
    return this.prisma.categoryRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { requestedBy: { select: { id: true, name: true } }, org: { select: { name: true } } },
    });
  }

  async reviewCustomCategoryRequest(id: string, reviewerId: string, status: 'REVIEWED_ADDED' | 'REVIEWED_DECLINED') {
    const req = await this.prisma.categoryRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Category request not found');
    return this.prisma.categoryRequest.update({
      where: { id },
      data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
    });
  }

  // ── Custom Field Promotion (Section 4, tier 2) ─────────────────────
  // Looks at every asset tagged with this category and counts how often
  // each customFields JSON key shows up — a key used repeatedly is a
  // strong signal it should be a real structured field, not permanent
  // per-asset freeform noise. Already-promoted keys are excluded.
  async getCustomFieldPromotionCandidates(categoryId: string, minOccurrences = 3) {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id: categoryId },
      include: { customFieldTemplates: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    const alreadyPromoted = new Set(category.customFieldTemplates.map((t) => t.key));

    const assets = await this.prisma.asset.findMany({
      where: { categoryLinks: { some: { categoryId } } },
      select: { customFields: true },
    });

    const counts = new Map<string, number>();
    for (const a of assets) {
      const cf = (a.customFields as Record<string, any>) || {};
      for (const key of Object.keys(cf)) {
        if (alreadyPromoted.has(key)) continue;
        if (cf[key] === undefined || cf[key] === null || cf[key] === '') continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .filter(([, count]) => count >= minOccurrences)
      .map(([key, count]) => ({ key, occurrences: count }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  async promoteCustomField(categoryId: string, dto: { key: string; label: string; fieldType?: string }, promotedById: string) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.categoryCustomFieldTemplate.upsert({
      where: { categoryId_key: { categoryId, key: dto.key } },
      update: { label: dto.label, fieldType: dto.fieldType || 'text' },
      create: { categoryId, key: dto.key, label: dto.label, fieldType: dto.fieldType || 'text', promotedById },
    });
  }

  /** Resolve which frameworks apply once given field values are known (Section 8 forced triggers). */
  resolveForcedFrameworks(fieldValues: Record<string, any>): string[] {
    return FORCED_FRAMEWORK_TRIGGERS.filter((t) => fieldValues[t.field] === t.value).map((t) => t.framework);
  }

  async create(dto: { code: string; name: string; description?: string; isTangible: boolean; fieldTemplate?: Record<string, any> }) {
    const codeNormalized = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.assetCategory.findUnique({ where: { code: codeNormalized } });
    if (existing) throw new ConflictException(`A category with code "${codeNormalized}" already exists`);

    return this.prisma.assetCategory.create({
      data: {
        code: codeNormalized,
        name: dto.name,
        description: dto.description,
        isTangible: dto.isTangible,
        fieldTemplate: dto.fieldTemplate ?? undefined,
      },
    });
  }

  async update(id: string, dto: { name?: string; description?: string; fieldTemplate?: Record<string, any>; isActive?: boolean }) {
    const existing = await this.prisma.assetCategory.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.assetCategory.update({ where: { id }, data: dto });
  }
}
