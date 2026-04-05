// tasks.controller.ts + tasks.service.ts combined
// File: src/tasks/tasks.controller.ts

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client';

class CreateTaskDto {
  @IsString()  findingId: string;
  @IsString()  title: string;
  @IsOptional() @IsString() description?: string;
  @IsString()  assignedToId: string;
  @IsDateString() dueDate: string;
}

class UpdateTaskDto {
  @IsOptional() @IsString()  title?: string;
  @IsOptional() @IsString()  description?: string;
  @IsOptional() @IsString()  assignedToId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  // GET /api/tasks?findingId=xxx
  @Get()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN','REVIEWER')
  async list(@Req() req: any) {
    const { findingId, assignedToId } = req.query;
    const user = req.user;

    const where: any = {};
    if (findingId) where.findingId = findingId;
    if (assignedToId) where.assignedToId = assignedToId;

    // Scope: non-admins only see tasks in their org
    if (user.role !== 'NIC_ADMIN') {
      where.finding = { orgId: { in: user.dataAccessScope || [user.orgId] } };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id:true, name:true, email:true, role:true } },
        createdBy:  { select: { id:true, name:true } },
        finding:    { select: { id:true, title:true, severity:true, status:true, org:{ select:{name:true,shortCode:true} } } },
      },
      orderBy: [{ status:'asc' }, { dueDate:'asc' }],
    });

    return tasks;
  }

  // GET /api/tasks/my — tasks assigned to me
  @Get('my')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN')
  async mine(@CurrentUser() user: any) {
    return this.prisma.task.findMany({
      where: { assignedToId: user.id },
      include: {
        finding: { select: { id:true, title:true, severity:true, status:true, slaDate:true, slaBreached:true, org:{ select:{name:true,shortCode:true} } } },
        createdBy: { select: { id:true, name:true } },
      },
      orderBy: [{ status:'asc' }, { dueDate:'asc' }],
    });
  }

  // POST /api/tasks
  @Post()
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY')
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: any) {
    const task = await this.prisma.task.create({
      data: {
        findingId:   dto.findingId,
        title:       dto.title,
        description: dto.description,
        assignedToId:dto.assignedToId,
        createdById: user.id,
        dueDate:     new Date(dto.dueDate),
        status:      TaskStatus.PENDING,
      },
      include: {
        assignedTo: { select: { id:true, name:true, email:true } },
        finding:    { select: { id:true, title:true, severity:true } },
      },
    });

    await this.ledger.record({
      userId: user.id, orgId: user.orgId,
      eventType: 'FINDING_CREATED', entityType: 'Task', entityId: task.id,
      payload: { findingId: dto.findingId, assignedTo: task.assignedTo.name, dueDate: dto.dueDate },
      ipAddress: 'unknown',
    });

    return task;
  }

  // PATCH /api/tasks/:id
  @Patch(':id')
  @Roles('NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: any) {
    const existing = await this.prisma.task.findFirst({ where: { id } });
    if (!existing) throw new Error('Task not found');

    const completedAt = dto.status === TaskStatus.COMPLETED ? new Date() : undefined;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate:     dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt,
      },
      include: {
        assignedTo: { select: { id:true, name:true } },
        finding:    { select: { id:true, title:true } },
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.ledger.record({
        userId: user.id, orgId: user.orgId,
        eventType: 'FINDING_STATUS_CHANGED', entityType: 'Task', entityId: id,
        payload: { from: existing.status, to: dto.status },
        ipAddress: 'unknown',
      });
    }

    return task;
  }

  // DELETE /api/tasks/:id — NIC_ADMIN only
  @Delete(':id')
  @Roles('NIC_ADMIN','DEPT_CISO')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }
}
