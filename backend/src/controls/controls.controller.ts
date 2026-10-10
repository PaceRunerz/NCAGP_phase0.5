import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('controls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ControlsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async findAll(@Query('framework') framework?: string) {
    return this.prisma.control.findMany({
      where: {
        isActive: true,
        ...(framework ? { frameworkMappings: { some: { framework: framework as any } } } : {}),
      },
      include: {
        frameworkMappings: { select: { framework: true, frameworkControlId: true, frameworkDomain: true } },
      },
      orderBy: { controlCode: 'asc' },
    });
  }
}
