import {
  Controller, Get, Post, Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { OrgType } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsUUID, Length } from 'class-validator';
import { Request } from 'express';

class CreateOrgDto {
  @IsString() name: string;
  @IsString() @Length(2, 10) shortCode: string;
  @IsEnum(OrgType) orgType: OrgType;
  @IsOptional() @IsUUID() parentOrgId?: string;
  @IsString() encryptionDomain: string;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.orgsService.findAll(user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orgsService.findOne(id);
  }

  @Post()
  @Roles('NIC_ADMIN')
  async create(
    @Body() dto: CreateOrgDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.orgsService.create({
      ...dto,
      createdById: user.id,
      ipAddress: req.ip || 'unknown',
    });
  }
}
