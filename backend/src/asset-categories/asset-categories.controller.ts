import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AssetCategoriesService } from './asset-categories.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

class CreateCategoryDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsBoolean() isTangible: boolean;
  @IsOptional() @IsObject() fieldTemplate?: Record<string, any>;
}

class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() fieldTemplate?: Record<string, any>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('asset-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetCategoriesController {
  constructor(private categories: AssetCategoriesService) {}

  // Everyone who touches Asset Register needs to read this list — it's
  // the multi-select options, not sensitive data.
  @Get()
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async list(@Query('includeInactive') includeInactive?: string): Promise<any> {
    return this.categories.list(includeInactive === 'true');
  }

  // NIC Admin or any Dept CISO can add a custom category — categories
  // aren't department-private data, they're shared classification
  // concepts everyone benefits from (once MHA adds "Biometric Scanner",
  // every other department can use it too instead of re-inventing it).
  @Post()
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async create(@Body() dto: CreateCategoryDto): Promise<any> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<any> {
    return this.categories.update(id, dto);
  }

  // Field Group Engine (Section 3) — everyone registering an asset needs
  // this to know which fields to render for the category they picked.
  @Get('field-groups')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  listFieldGroups(): any {
    return this.categories.listFieldGroups();
  }

  @Get(':id/fields')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getResolvedFields(@Param('id') id: string): Promise<any> {
    return this.categories.getResolvedFields(id);
  }

  // ── Custom Category Requests (Section 2) ──────────────────────────
  @Post('custom-category-requests')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  async requestCustomCategory(@Body() dto: { requestedName: string; notes?: string }, @CurrentUser() user: any): Promise<any> {
    return this.categories.requestCustomCategory({
      orgId: user.orgId,
      requestedById: user.id,
      requestedName: dto.requestedName,
      notes: dto.notes,
    });
  }

  @Get('custom-category-requests')
  @Roles('NIC_ADMIN')
  async listCustomCategoryRequests(@Query('status') status?: string): Promise<any> {
    return this.categories.listCustomCategoryRequests(status);
  }

  @Patch('custom-category-requests/:id/review')
  @Roles('NIC_ADMIN')
  async reviewCustomCategoryRequest(
    @Param('id') id: string,
    @Body('status') status: 'REVIEWED_ADDED' | 'REVIEWED_DECLINED',
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.categories.reviewCustomCategoryRequest(id, user.id, status);
  }

  // ── Custom Field Promotion (Section 4, tier 2) ─────────────────────
  @Get(':id/custom-field-suggestions')
  @Roles('NIC_ADMIN')
  async getCustomFieldPromotionCandidates(@Param('id') id: string): Promise<any> {
    return this.categories.getCustomFieldPromotionCandidates(id);
  }

  @Post(':id/promote-custom-field')
  @Roles('NIC_ADMIN')
  async promoteCustomField(
    @Param('id') id: string,
    @Body() dto: { key: string; label: string; fieldType?: string },
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.categories.promoteCustomField(id, dto, user.id);
  }

  // One-time/idempotent: populate the full ~40-category Section 2
  // taxonomy. NIC Admin only — this seeds/refreshes system categories,
  // safe to re-run any time (upsert by code).
  @Post('seed-taxonomy')
  @Roles('NIC_ADMIN')
  async seedTaxonomy(): Promise<any> {
    return this.categories.seedTaxonomy();
  }
}
