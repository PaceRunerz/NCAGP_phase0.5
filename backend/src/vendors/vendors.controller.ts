// vendors.controller.ts
import { Controller, Get, Post, Param, UseGuards, ForbiddenException } from '@nestjs/common';
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
  async score(@Param('orgId') orgId: string, @CurrentUser() user: any) {
    // FIX (Phase 6 audit): a VENDOR_ADMIN could pass any OTHER vendor
    // firm's orgId and see their trust/performance score — no scoping
    // existed at all. Unlike NIC_ADMIN/DEPT_CISO/REVIEWER (who
    // legitimately need to compare vendors), a vendor firm shouldn't
    // see a competitor's internal scorecard.
    if (user.role === 'VENDOR_ADMIN' && user.orgId !== orgId) {
      throw new ForbiddenException('Cannot view another vendor firm\'s score');
    }
    return this.scoring.getScores(orgId);
  }

  @Post(':orgId/rescore')
  @Roles('NIC_ADMIN')
  async rescore(@Param('orgId') orgId: string) { return this.scoring.scoreVendor(orgId); }

  @Post('rescore-all')
  @Roles('NIC_ADMIN')
  async rescoreAll() {
    await this.scoring.runNightlyScoring();
    return { message: 'Vendor rescoring completed', timestamp: new Date() };
  }
}
