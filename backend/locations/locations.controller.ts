// ─────────────────────────────────────────────────────────────────
// SYNC — ITAM Location Hierarchy Controller
// File: src/locations/locations.controller.ts
// ─────────────────────────────────────────────────────────────────

import { Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsOptional, IsUUID } from 'class-validator';

class CreateSiteDto {
  @IsUUID() orgId: string;
  @IsString() name: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
}

class CreateBuildingDto {
  @IsUUID() siteId: string;
  @IsString() name: string;
}

class CreateFloorDto {
  @IsUUID() buildingId: string;
  @IsString() name: string;
}

class CreateSubLocationDto {
  @IsUUID() floorId: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
  constructor(private locations: LocationsService) {}

  // ── Full tree — one call powers the whole cascading picker ──
  @Get('tree')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async getTree(@Query('orgId') orgId: string) {
    if (!orgId) throw new BadRequestException('orgId is required');
    return this.locations.getLocationTree(orgId);
  }

  // ── Sites ─────────────────────────────────────────────────────
  @Get('sites')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async listSites(@Query('orgId') orgId: string) {
    if (!orgId) throw new BadRequestException('orgId is required');
    return this.locations.listSites(orgId);
  }

  @Post('sites')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async createSite(@Body() dto: CreateSiteDto, @CurrentUser() user: any) {
    return this.locations.createSite(dto, user);
  }

  // ── Buildings ─────────────────────────────────────────────────
  @Get('sites/:siteId/buildings')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async listBuildings(@Param('siteId') siteId: string) {
    return this.locations.listBuildings(siteId);
  }

  @Post('buildings')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async createBuilding(@Body() dto: CreateBuildingDto, @CurrentUser() user: any) {
    return this.locations.createBuilding(dto, user);
  }

  // ── Floors ────────────────────────────────────────────────────
  @Get('buildings/:buildingId/floors')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async listFloors(@Param('buildingId') buildingId: string) {
    return this.locations.listFloors(buildingId);
  }

  @Post('floors')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async createFloor(@Body() dto: CreateFloorDto, @CurrentUser() user: any) {
    return this.locations.createFloor(dto, user);
  }

  // ── Sub-locations ─────────────────────────────────────────────
  @Get('floors/:floorId/sub-locations')
  @Roles('NIC_ADMIN', 'DEPT_CISO', 'DEPT_SECURITY', 'AUDITOR', 'VENDOR_ADMIN', 'REVIEWER')
  async listSubLocations(@Param('floorId') floorId: string) {
    return this.locations.listSubLocations(floorId);
  }

  @Post('sub-locations')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async createSubLocation(@Body() dto: CreateSubLocationDto, @CurrentUser() user: any) {
    return this.locations.createSubLocation(dto, user);
  }
}
