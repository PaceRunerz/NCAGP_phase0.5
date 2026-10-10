import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import * as bcrypt from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  // ── GET /api/users ─────────────────────────────────────
  @Get()
  @Roles('NIC_ADMIN', 'REVIEWER')
  async list() {
    return this.prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        orgId: true, isActive: true, mfaEnabled: true, createdAt: true,
        org: { select: { name: true, shortCode: true, orgType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── POST /api/users ────────────────────────────────────
  @Post()
  @Roles('NIC_ADMIN')
  async create(@Body() body: any) {
    // Validate required fields
    if (!body.name?.trim())     throw new BadRequestException('Full name is required');
    if (!body.email?.trim())    throw new BadRequestException('Email address is required');
    if (!body.password)         throw new BadRequestException('Password is required');
    if (body.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (!body.role)             throw new BadRequestException('Role is required');
    if (!body.orgId)            throw new BadRequestException('Organisation is required');

    const email = body.email.toLowerCase().trim();

    // Check duplicate email — give clear error instead of 500
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`Email "${email}" is already registered. Use a different email address.`);
    }

    // Validate org exists
    const org = await this.prisma.organization.findUnique({ where: { id: body.orgId } });
    if (!org) throw new BadRequestException('Selected organisation does not exist');

    const hash = await bcrypt.hash(body.password, 12);

    return this.prisma.user.create({
      data: {
        name:           body.name.trim(),
        email,
        role:           body.role,
        orgId:          body.orgId,
        passwordHash:   hash,
        isActive:       true,
        mfaEnabled:     false,
        failedAttempts: 0,
      },
      select: {
        id: true, name: true, email: true,
        role: true, orgId: true, isActive: true,
        org: { select: { name: true, shortCode: true } },
      },
    });
  }

  // ── PATCH /api/users/:id ───────────────────────────────
  @Patch(':id')
  @Roles('NIC_ADMIN')
  async update(@Param('id') id: string, @Body() body: any) {
    // Check user exists
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (body.name?.trim())           data.name     = body.name.trim();
    if (body.role)                   data.role     = body.role;
    if (body.orgId)                  data.orgId    = body.orgId;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) {
      if (body.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true,
        role: true, orgId: true, isActive: true,
        org: { select: { name: true, shortCode: true } },
      },
    });
  }
}