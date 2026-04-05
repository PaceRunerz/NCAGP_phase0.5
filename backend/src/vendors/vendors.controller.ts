// vendors.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { VendorScoringService } from './vendor-scoring.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private scoring: VendorScoringService) {}

  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER')
  async all() { return this.scoring.getAllScores(); }

  @Get(':orgId/score')
  @Roles('NIC_ADMIN','DEPT_CISO','REVIEWER','VENDOR_ADMIN')
  async score(@Param('orgId') orgId: string) { return this.scoring.getScores(orgId); }

  @Post(':orgId/rescore')
  @Roles('NIC_ADMIN')
  async rescore(@Param('orgId') orgId: string) { return this.scoring.scoreVendor(orgId); }

  @Post('rescore-all')
  @Roles('NIC_ADMIN')
  async rescoreAll() { return this.scoring.runNightlyScoring(); }
}
