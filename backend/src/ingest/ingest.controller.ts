// ─────────────────────────────────────────────────────────────────
// NCAGP — Scanner Ingestion Controller
// File: src/ingest/ingest.controller.ts
//
// PRD Reference: Section 8 (API ingestion for Nessus/OpenVAS)
//
// Authentication: X-API-Key header (NOT JWT)
// Validates key against api_keys table, checks scopes.
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Post, Body, Headers, Req,
  UnauthorizedException, ForbiddenException,
  BadRequestException, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IngestService, ScannerPayload } from './ingest.service';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { Request } from 'express';
import { IsString, IsArray, IsOptional, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

// ── DTOs ──────────────────────────────────────────────────────────

class SingleFindingDto implements ScannerPayload {
  @IsString() audit_id:   string;
  @IsString() severity:   string;
  @IsString() title:      string;
  @IsString() description:string;

  @IsOptional() @IsString() asset_id?:        string;
  @IsOptional() @IsString() control_id?:      string;
  @IsOptional() @IsString() root_cause?:      string;
  @IsOptional() @IsString() recommendation?:  string;
  @IsOptional() @IsString() technical_detail?:string;
  @IsOptional() @IsString() plugin_id?:       string;
  @IsOptional() @IsString() plugin_name?:     string;
  @IsOptional() @IsString() host?:            string;
  @IsOptional() @IsString() port?:            string;
  @IsOptional() @IsString() protocol?:        string;
  @IsOptional() @IsString() solution?:        string;
  @IsOptional() @IsString() synopsis?:        string;
  @IsOptional()             cvss_score?:      number;
  @IsOptional() @IsArray()  cve?:             string[];
  @IsOptional() @IsArray()  cwe?:             string[];
  @IsOptional() @IsString() rule_key?:        string;
  @IsOptional() @IsString() component?:       string;
  @IsOptional() @IsString() message?:         string;
  @IsOptional() @IsString() oid?:             string;
  @IsOptional() @IsString() nvt_name?:        string;
  @IsOptional() @IsString() threat?:          string;
}

class BatchFindingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SingleFindingDto)
  findings: SingleFindingDto[];
}

// ── Controller ─────────────────────────────────────────────────────

@Controller('v1/ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(
    private ingestService: IngestService,
    private apiKeysService: ApiKeysService,
  ) {}

  /**
   * POST /api/v1/ingest/scanner
   *
   * Single finding ingestion from scanner tool.
   *
   * Example curl (Nessus-style):
   * curl -X POST https://ncagp.nic.in/api/v1/ingest/scanner \
   *   -H "X-API-Key: ncagp_sk_abc123..." \
   *   -H "Content-Type: application/json" \
   *   -d '{
   *     "audit_id": "uuid-of-audit",
   *     "severity": "critical",
   *     "title": "SSL Certificate Expired",
   *     "description": "The SSL certificate on port 443 has expired.",
   *     "host": "portal.mha.gov.in",
   *     "port": "443",
   *     "plugin_id": "56984",
   *     "cve": ["CVE-2023-1234"]
   *   }'
   */
  @Post('scanner')
  @HttpCode(HttpStatus.CREATED)
  async ingestSingle(
    @Body() dto: SingleFindingDto,
    @Headers('x-api-key') apiKey: string,
    @Req() req: Request,
  ) {
    const { orgId } = await this.validateApiKey(apiKey, 'FINDINGS_WRITE');

    const result = await this.ingestService.ingestFinding(
      dto,
      orgId,
      apiKey.slice(0, 16), // Store only prefix in ledger
      req.ip || 'unknown',
    );

    return {
      success:  true,
      ...result,
    };
  }

  /**
   * POST /api/v1/ingest/scanner/batch
   *
   * Batch ingestion — send entire scan report at once.
   * Recommended for full Nessus/OpenVAS scan exports.
   *
   * Max 500 findings per batch request.
   */
  @Post('scanner/batch')
  @HttpCode(HttpStatus.CREATED)
  async ingestBatch(
    @Body() dto: BatchFindingsDto,
    @Headers('x-api-key') apiKey: string,
    @Req() req: Request,
  ) {
    if (dto.findings.length > 500) {
      throw new BadRequestException('Batch size exceeds limit of 500 findings. Split into multiple requests.');
    }

    const { orgId } = await this.validateApiKey(apiKey, 'FINDINGS_WRITE');

    const result = await this.ingestService.ingestBatch(
      dto.findings,
      orgId,
      apiKey.slice(0, 16),
      req.ip || 'unknown',
    );

    this.logger.log(
      `Batch ingestion complete: ${result.created} created, ${result.duplicates} duplicates, ${result.errors} errors`
    );

    return {
      success: result.errors === 0 || result.created > 0,
      ...result,
    };
  }

  // ── Private: API key validation ────────────────────────────────

  private async validateApiKey(
    rawKey: string,
    requiredScope: string,
  ): Promise<{ orgId: string; scopes: string[] }> {
    if (!rawKey) {
      throw new UnauthorizedException(
        'Missing X-API-Key header. Generate a key at /settings in the NCAGP portal.',
      );
    }

    if (!rawKey.startsWith('ncagp_sk_')) {
      throw new UnauthorizedException('Invalid API key format. Must start with ncagp_sk_');
    }

    const keyData = await this.apiKeysService.validateKey(rawKey);

    if (!keyData) {
      throw new UnauthorizedException(
        'Invalid or revoked API key. Generate a new key at /settings.',
      );
    }

    if (!keyData.scopes.includes(requiredScope) && !keyData.scopes.includes('FULL_ACCESS')) {
      throw new ForbiddenException(
        `API key lacks required scope: ${requiredScope}. ` +
        `Key scopes: ${keyData.scopes.join(', ')}. Update key permissions in the portal.`,
      );
    }

    return keyData;
  }
}
