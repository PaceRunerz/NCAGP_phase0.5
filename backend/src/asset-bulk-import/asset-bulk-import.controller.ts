// ─────────────────────────────────────────────────────────────────
// SYNC — Bulk Import via Template Controller (Spec Section 7)
// File: src/asset-bulk-import/asset-bulk-import.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AssetBulkImportService } from './asset-bulk-import.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString } from 'class-validator';

class CommitBulkImportDto {
  @IsString() categoryId: string;
  @IsString() batchName: string;
  rows: any[];
}

@Controller('assets/bulk-import')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class AssetBulkImportController {
  constructor(private bulkImport: AssetBulkImportService) {}

  // GET /api/assets/bulk-import/template/:categoryId — downloadable CSV
  // template with exactly the columns relevant to that category
  // (Section 7, step 2).
  @Get('template/:categoryId')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  async downloadTemplate(@Param('categoryId') categoryId: string, @Res() res: Response) {
    const { filename, csv } = await this.bulkImport.generateTemplate(categoryId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // POST /api/assets/bulk-import/validate/:categoryId — dry-run
  // validation, Section 6 rule 5. Never writes to the DB.
  @Post('validate/:categoryId')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async validate(
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<any> {
    if (!file) throw new BadRequestException('A CSV file is required');
    const csvText = file.buffer.toString('utf-8');
    return this.bulkImport.validate(categoryId, user.orgId, csvText);
  }

  // POST /api/assets/bulk-import/commit — writes only the rows the user
  // confirmed after reviewing the validation report, one transaction
  // (Section 7, step 6).
  @Post('commit')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  async commit(@Body() dto: CommitBulkImportDto, @CurrentUser() user: any): Promise<any> {
    return this.bulkImport.commit({
      categoryId: dto.categoryId,
      orgId: user.orgId,
      batchName: dto.batchName,
      createdById: user.id,
      rows: dto.rows,
    });
  }
}
