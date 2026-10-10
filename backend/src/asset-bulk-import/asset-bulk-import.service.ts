// ─────────────────────────────────────────────────────────────────
// SYNC — Bulk Import via Template (Asset Register Spec, Section 7)
// Flow: generate a per-category CSV template -> user fills offline ->
// upload -> dry-run validate (Section 6 rule 5, never a partial silent
// write) -> user reviews report -> commit only the valid rows in one
// DB transaction, one ledger entry per asset plus one batch summary
// entry.
// File: src/asset-bulk-import/asset-bulk-import.service.ts
// ─────────────────────────────────────────────────────────────────

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { resolveFieldsForGroups, ALWAYS_REQUIRED_FIELDS, FieldDef } from '../asset-categories/field-groups.config';
import { stringifyCsv, parseCsvToObjects } from './csv-utils';

export interface ValidationError {
  row: number; // 1-indexed, matches spreadsheet row (header = row 1)
  message: string;
}

export interface ValidatedRow {
  row: number;
  name: string;
  businessUnit: string;
  criticality: number;
  dataSensitivity: string;
  model?: string;
  ipAddress?: string;
  macAddress?: string;
  serialNumber?: string;
  assetTag?: string;
  customFields: Record<string, any>;
}

const BASE_UNIVERSAL_COLUMNS: { key: string; label: string; required: boolean }[] = [
  { key: 'name', label: 'Asset Name', required: true },
  { key: 'businessUnit', label: 'Department', required: true },
  { key: 'criticality', label: 'Criticality (1-5)', required: true },
  { key: 'dataSensitivity', label: 'Data Sensitivity (PUBLIC/INTERNAL/CONFIDENTIAL/SECRET)', required: true },
];
const TAIL_UNIVERSAL_COLUMNS: { key: string; label: string; required: boolean }[] = [
  { key: 'serialNumber', label: 'Serial Number', required: false },
  { key: 'assetTag', label: 'Asset Tag', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

/**
 * Model/IP/MAC are only relevant — and only mandatory — for categories
 * that actually declare physical hardware identity (Group 1) or network
 * fields (Group 3). A Software License or a Building has neither, so
 * forcing an IP address into that CSV row would be nonsensical.
 */
function universalColumnsFor(categoryFieldGroups: string[]): { key: string; label: string; required: boolean }[] {
  const cols = [...BASE_UNIVERSAL_COLUMNS];
  if (categoryFieldGroups.includes('GROUP_1_PHYSICAL_IDENTITY')) {
    cols.push({ key: 'model', label: 'Model', required: true });
  }
  if (categoryFieldGroups.includes('GROUP_3_NETWORK')) {
    cols.push({ key: 'ipAddress', label: 'IP Address', required: true });
    cols.push({ key: 'macAddress', label: 'MAC Address', required: true });
  }
  return [...cols, ...TAIL_UNIVERSAL_COLUMNS];
}

@Injectable()
export class AssetBulkImportService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  private async getCategoryFields(categoryId: string): Promise<{ category: any; fields: FieldDef[] }> {
    const category = await this.prisma.assetCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    const fields = resolveFieldsForGroups(category.fieldGroups?.length ? category.fieldGroups : []).filter(
      // Universal group fields (criticality, dataSensitivity, businessUnit, etc.)
      // are already columns above via UNIVERSAL_COLUMNS — don't duplicate them.
      (f) => !['criticality', 'dataSensitivity', 'businessUnit', 'description', 'tags', 'status', 'custodianOrgId', 'model', 'ipAddress', 'macAddress'].includes(f.key),
    );
    return { category, fields };
  }

  /**
   * Section 7: "example template columns for Desktop Computer" — the
   * template generator includes/excludes columns based on which Field
   * Groups the category pulls from. Same shape for every category.
   */
  async generateTemplate(categoryId: string): Promise<{ filename: string; csv: string }> {
    const { category, fields } = await this.getCategoryFields(categoryId);
    const universalColumns = universalColumnsFor(category.fieldGroups || []);
    const header = [...universalColumns.map((c) => c.label), ...fields.map((f) => f.label + (f.required ? ' *' : ''))];
    // One example row so the person filling it in Excel sees the expected shape.
    const exampleValues: Record<string, string> = {
      name: `${category.name} 1`,
      businessUnit: 'IT Division',
      criticality: '3',
      dataSensitivity: 'INTERNAL',
      model: 'e.g. OptiPlex 7010',
      ipAddress: 'e.g. 10.0.4.12',
      macAddress: 'e.g. 3C:52:82:1A:9F:0B',
    };
    const exampleRow = [...universalColumns.map((c) => exampleValues[c.key] ?? ''), ...fields.map(() => '')];
    const csv = stringifyCsv([header, exampleRow]);
    return { filename: `${category.code}_bulk_import_template.csv`, csv };
  }

  private buildHeaderLabelToKeyMap(fields: FieldDef[], universalColumns: { key: string; label: string; required: boolean }[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const c of universalColumns) map[c.label.toLowerCase()] = c.key;
    for (const f of fields) {
      map[f.label.toLowerCase()] = f.key;
      map[(f.label + ' *').toLowerCase()] = f.key;
    }
    return map;
  }

  /**
   * Section 6, rule 5: dry-run validation pass — missing required
   * fields, malformed dates, duplicate serials — shown to the user
   * BEFORE anything is written to the database. Never a partial silent
   * bulk-write.
   */
  async validate(categoryId: string, orgId: string, csvText: string): Promise<{ validCount: number; errorCount: number; validRows: ValidatedRow[]; errors: ValidationError[] }> {
    const { category, fields } = await this.getCategoryFields(categoryId);
    const categoryGroups: string[] = category.fieldGroups || [];
    const needsModel = categoryGroups.includes('GROUP_1_PHYSICAL_IDENTITY');
    const needsNetwork = categoryGroups.includes('GROUP_3_NETWORK');
    const universalColumns = universalColumnsFor(categoryGroups);
    const headerMap = this.buildHeaderLabelToKeyMap(fields, universalColumns);
    const objects = parseCsvToObjects(csvText, headerMap);

    if (objects.length === 0) {
      throw new BadRequestException('The uploaded file has no data rows (only a header, or is empty)');
    }

    const errors: ValidationError[] = [];
    const validRows: ValidatedRow[] = [];
    const seenSerialsInFile = new Set<string>();

    // Section 6, rule 6: duplicate serials within the org are rejected,
    // not silently overwritten — check against what's already in the DB.
    const existingSerials = new Set(
      (
        await this.prisma.asset.findMany({
          where: { orgId, serialNumber: { not: null } },
          select: { serialNumber: true },
        })
      )
        .map((a) => a.serialNumber!.trim().toLowerCase())
        .filter(Boolean),
    );

    objects.forEach((obj, idx) => {
      const row = idx + 2; // +1 for 0-index, +1 for header row
      const rowErrors: string[] = [];

      if (!obj.name) rowErrors.push('Missing Asset Name');
      if (!obj.businessUnit) rowErrors.push('Missing Department');
      // Model/IP/MAC are only mandatory for categories that actually
      // declare hardware identity / network fields (Section 3, Groups 1
      // & 3) — a Software License or Building CSV never asks for these.
      if (needsModel && !obj.model?.trim()) rowErrors.push('Missing Model');
      if (needsNetwork && !obj.ipAddress?.trim()) rowErrors.push('Missing IP Address');
      if (needsNetwork && !obj.macAddress?.trim()) rowErrors.push('Missing MAC Address');

      const criticality = Number(obj.criticality);
      if (!obj.criticality || isNaN(criticality) || criticality < 1 || criticality > 5) {
        rowErrors.push('Criticality must be a number 1-5');
      }

      const sensitivity = (obj.dataSensitivity || '').toUpperCase();
      if (!['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'].includes(sensitivity)) {
        rowErrors.push('Data Sensitivity must be one of PUBLIC / INTERNAL / CONFIDENTIAL / SECRET');
      }

      const serial = obj.serialNumber?.trim();
      if (serial) {
        const normalized = serial.toLowerCase();
        if (existingSerials.has(normalized)) rowErrors.push(`Duplicate Serial Number "${serial}" — already exists in this organisation`);
        else if (seenSerialsInFile.has(normalized)) rowErrors.push(`Duplicate Serial Number "${serial}" — repeated within this file`);
        else seenSerialsInFile.add(normalized);
      }

      const customFields: Record<string, any> = {};
      for (const f of fields) {
        const raw = obj[f.key];
        if (f.type === 'date' && raw) {
          const d = new Date(raw);
          if (isNaN(d.getTime())) {
            rowErrors.push(`"${f.label}" is not a valid date: "${raw}"`);
          } else {
            customFields[f.key] = raw;
            // Section 6, rule 4: flag past expiry dates on save, not silently.
            if (f.drivesExpiryAlert && d.getTime() < Date.now()) {
              rowErrors.push(`WARNING (not blocking): "${f.label}" is already in the past (${raw})`);
            }
          }
        } else if (f.required && !raw) {
          rowErrors.push(`Missing required field "${f.label}"`);
        } else if (raw) {
          customFields[f.key] = raw;
        }
      }

      if (rowErrors.some((e) => !e.startsWith('WARNING'))) {
        rowErrors.forEach((message) => errors.push({ row, message }));
        return;
      }
      // Rows with only WARNING-prefixed issues still pass through to
      // validRows, but the warnings are still surfaced to the user.
      rowErrors.forEach((message) => errors.push({ row, message }));

      validRows.push({
        row,
        name: obj.name,
        businessUnit: obj.businessUnit,
        criticality,
        dataSensitivity: sensitivity,
        model: obj.model?.trim() || undefined,
        ipAddress: obj.ipAddress?.trim() || undefined,
        macAddress: obj.macAddress?.trim() || undefined,
        serialNumber: serial || undefined,
        assetTag: obj.assetTag?.trim() || undefined,
        customFields,
      });
    });

    return { validCount: validRows.length, errorCount: errors.filter((e) => !e.message.startsWith('WARNING')).length, validRows, errors };
  }

  /**
   * Commits only the rows the caller confirms (normally: everything
   * validate() returned in validRows, after the user reviewed the
   * report). One transaction, one ledger entry per asset plus one
   * "batch import" summary entry — Section 7, step 6.
   */
  async commit(dto: {
    categoryId: string;
    orgId: string;
    batchName: string;
    createdById: string;
    rows: ValidatedRow[];
  }) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('No valid rows to commit');
    }

    const batch = await this.prisma.assetBatch.create({
      data: {
        orgId: dto.orgId,
        name: dto.batchName,
        createdById: dto.createdById,
        assetCount: dto.rows.length,
      },
    });

    const createdAssets = await this.prisma.$transaction(
      dto.rows.map((r) =>
        this.prisma.asset.create({
          data: {
            orgId: dto.orgId,
            name: r.name,
            businessUnit: r.businessUnit,
            criticality: r.criticality,
            dataSensitivity: r.dataSensitivity,
            environment: 'PRODUCTION',
            model: r.model,
            ipAddress: r.ipAddress,
            serialNumber: r.serialNumber,
            assetTag: r.assetTag,
            batchId: batch.id,
            // macAddress has no dedicated Asset column — same as the
            // interactive form, it travels through customFields.
            customFields: r.macAddress ? { ...r.customFields, macAddress: r.macAddress } : (Object.keys(r.customFields).length ? r.customFields : undefined),
            assetType: 'OTHER' as any,
          },
        }),
      ),
    );

    await this.prisma.assetCategoryLink.createMany({
      data: createdAssets.map((a) => ({ assetId: a.id, categoryId: dto.categoryId })),
      skipDuplicates: true,
    });

    // One ledger entry per asset — every asset creation is individually
    // auditable, not hidden inside a batch blob.
    for (const asset of createdAssets) {
      await this.ledger.record({
        userId: dto.createdById,
        orgId: dto.orgId,
        eventType: 'ASSET_CATEGORY_ASSIGNED' as any,
        entityType: 'Asset',
        entityId: asset.id,
        payload: { source: 'BULK_CSV_IMPORT', batchId: batch.id, categoryId: dto.categoryId },
        ipAddress: 'unknown',
      });
    }
    // Plus one batch-level summary entry.
    await this.ledger.record({
      userId: dto.createdById,
      orgId: dto.orgId,
      eventType: 'ASSET_BATCH_CREATED' as any,
      entityType: 'AssetBatch',
      entityId: batch.id,
      payload: { batchName: dto.batchName, assetCount: createdAssets.length, source: 'BULK_CSV_IMPORT', categoryId: dto.categoryId },
      ipAddress: 'unknown',
    });

    return { batch, assetsCreated: createdAssets.length };
  }
}
