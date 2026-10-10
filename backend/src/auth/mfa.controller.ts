// ─────────────────────────────────────────────────────────────────
// NCAGP — MFA Controller
// File: src/auth/mfa.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './guards/auth.guard';
import { CurrentUser } from './roles.decorator';
import { IsString, MinLength } from 'class-validator';
import { Request } from 'express';

class VerifyMfaDto {
  @IsString() @MinLength(6) totpCode: string;
}

@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private mfa: MfaService) {}

  /** GET /api/auth/mfa/status */
  @Get('status')
  async status(@CurrentUser() user: any) {
    return this.mfa.getMfaStatus(user.id);
  }

  /** POST /api/auth/mfa/setup — returns QR code */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setup(@CurrentUser() user: any) {
    return this.mfa.setupMfa(user.id);
  }

  /** POST /api/auth/mfa/enable — verify TOTP and activate */
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @Body() dto: VerifyMfaDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    await this.mfa.enableMfa(user.id, user.orgId, dto.totpCode, req.ip || 'unknown');
    return { message: 'MFA enabled successfully. Your account is now protected with two-factor authentication.' };
  }

  /** POST /api/auth/mfa/disable — requires current TOTP */
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @Body() dto: VerifyMfaDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    await this.mfa.disableMfa(user.id, user.orgId, dto.totpCode, req.ip || 'unknown');
    return { message: 'MFA disabled.' };
  }
}
