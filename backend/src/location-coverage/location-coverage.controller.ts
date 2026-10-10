// ─────────────────────────────────────────────────────────────────
// SYNC — Location Coverage Tree Controller (Spec Section 9, item 1)
// File: src/location-coverage/location-coverage.controller.ts
// ─────────────────────────────────────────────────────────────────

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LocationCoverageService } from './location-coverage.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';

@Controller('location-coverage')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class LocationCoverageController {
  constructor(private coverage: LocationCoverageService) {}

  // GET /api/location-coverage — Org → Site → Building → Floor → Room
  // tree, asset count + checklist completion % per node. NIC_ADMIN can
  // pass ?orgId= to view another org; everyone else is scoped to their own.
  @Get()
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getTree(@Query('orgId') orgId: string | undefined, @CurrentUser() user: any): Promise<any> {
    const scopedOrgId = user.role === 'NIC_ADMIN' && orgId ? orgId : user.orgId;
    return this.coverage.getTree(scopedOrgId);
  }
}
