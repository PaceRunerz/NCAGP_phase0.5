import { Controller, Get, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  /**
   * GET /api/reports/national-risk — the cross-department "National Risk
   * Posture" PDF (all departments, department-wise risk scores, executive
   * KPIs). NIC_ADMIN and REVIEWER only — this report is inherently
   * cross-department by design, so it never made sense on a single
   * department's CISO Portal. DEPT_CISO now gets department-scoped
   * reports instead (see all-audits / monthly below).
   */
  @Get('national-risk')
  @Roles('NIC_ADMIN', 'REVIEWER')
  async downloadNationalRisk(@Res() res: Response) {
    const pdfBuffer = await this.reports.generateNationalRiskReport();
    const filename = `NCAGP-Risk-Report-${new Date().toISOString().slice(0,10)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Report-Generated': new Date().toISOString(),
    });
    res.send(pdfBuffer);
  }

  /**
   * GET /api/reports/earliest-year — bounds the "Pick a Month" year
   * dropdown. DEPT_CISO is always scoped to their own department's
   * earliest audit, regardless of what (if anything) they pass in orgId —
   * never trust org scoping from the client for a role that's supposed to
   * be confined to one org.
   */
  @Get('earliest-year')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async earliestYear(@Query('orgId') orgId: string, @CurrentUser() user: any) {
    const scopedOrgId = user.role === 'DEPT_CISO' ? user.orgId : (orgId || undefined);
    return this.reports.getEarliestYear(scopedOrgId);
  }

  /**
   * GET /api/reports/all-audits — NIC_ADMIN gets every audit, all
   * departments (orgId omitted). DEPT_CISO always gets only their own
   * department's audits — this is what makes "Download All" mean "all of
   * MY department's audits" on the CISO Portal instead of the whole
   * country's data.
   */
  @Get('all-audits')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async downloadAllAudits(@Query('orgId') orgId: string, @CurrentUser() user: any, @Res() res: Response) {
    const scopedOrgId = user.role === 'DEPT_CISO' ? user.orgId : (orgId || undefined);
    const pdfBuffer = await this.reports.generateAllAuditsReport(scopedOrgId);
    const suffix = scopedOrgId ? `-${scopedOrgId.slice(0, 8)}` : '';
    const filename = `NCAGP-All-Audits-Report${suffix}-${new Date().toISOString().slice(0,10)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Report-Generated': new Date().toISOString(),
    });
    res.send(pdfBuffer);
  }

  /** GET /api/reports/monthly?month=&year= — same department scoping as above */
  @Get('monthly')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async downloadMonthly(
    @Query('month') monthQ: string,
    @Query('year') yearQ: string,
    @Query('orgId') orgId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const month = Number(monthQ);
    const year = Number(yearQ);
    if (!month || month < 1 || month > 12 || !year || year < 2000) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const scopedOrgId = user.role === 'DEPT_CISO' ? user.orgId : (orgId || undefined);
    const pdfBuffer = await this.reports.generateMonthlyReport(month, year, scopedOrgId);
    const filename = `NCAGP-Monthly-Report-${year}-${String(month).padStart(2, '0')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Report-Generated': new Date().toISOString(),
    });
    res.send(pdfBuffer);
  }
}
