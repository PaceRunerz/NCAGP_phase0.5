// ─────────────────────────────────────────────────────────────────
// SYNC — Expiry Radar Controller (Spec Section 8/9)
// File: src/expiry-radar/expiry-radar.controller.ts
// ─────────────────────────────────────────────────────────────────

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExpiryRadarService } from './expiry-radar.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';

@Controller('expiry-radar')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class ExpiryRadarController {
  constructor(private radar: ExpiryRadarService) {}

  // GET /api/expiry-radar?horizonDays=90
  // NIC_ADMIN sees every org; everyone else is scoped to their own org
  // regardless of what (if anything) they pass, same org-isolation
  // pattern used elsewhere in the app.
  @Get()
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getRadar(@Query('horizonDays') horizonDays: string | undefined, @CurrentUser() user: any): Promise<any> {
    const orgId = user.role === 'NIC_ADMIN' ? null : user.orgId;
    return this.radar.getRadar(orgId, horizonDays ? Number(horizonDays) : 90);
  }
}
