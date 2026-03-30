import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  /** GET /api/reports/national-risk — download PDF */
  @Get('national-risk')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
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
}
