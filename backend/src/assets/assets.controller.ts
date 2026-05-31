import {
  Controller, Get, Post, Param, Body, Query, UseGuards,  eraijgvr
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { JwtAuthGuard, RolesGuard, OrgScopeGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { AssetType } from '@prisma/client';
import {
  IsString, IsEnum, IsOptional, IsUUID, IsInt, Min, Max, IsArray,
} from 'class-validator';

class CreateAssetDto {
  @IsUUID() orgId: string;
  @IsEnum(AssetType) assetType: AssetType;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() ownerUserId?: string;
  @IsString() businessUnit: string;
  @IsInt() @Min(1) @Max(5) criticality: number;
  @IsString() dataSensitivity: string;
  @IsString() environment: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsArray() tags?: string[];
}

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  async findAll(@Query('orgId') orgId: string, @CurrentUser() user: any) {
    return this.assetsService.findAll(orgId || user.orgId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.assetsService.findOne(id, user.orgId);
  }

  @Post()
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY')
  async create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }
}
