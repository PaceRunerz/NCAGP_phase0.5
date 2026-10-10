import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { IsString, IsArray, IsOptional, IsInt, Min, Max, MinLength, ArrayMinSize } from 'class-validator';
import { Request } from 'express';

class CreateApiKeyDto {
  @IsString() @MinLength(3) name: string;

  @IsArray() @ArrayMinSize(1)
  scopes: string[];

  @IsOptional() @IsInt() @Min(1) @Max(365)
  expiresInDays?: number;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private apiKeys: ApiKeysService) {}

  /** GET /api/api-keys — list keys for your org */
  @Get()
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async list(@CurrentUser() user: any) {
    return this.apiKeys.list(user.orgId);
  }

  /** POST /api/api-keys — create new key (SHOWS RAW KEY ONCE) */
  @Post()
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.apiKeys.create({
      name: dto.name,
      scopes: dto.scopes,
      orgId: user.orgId,
      createdById: user.id,
      expiresInDays: dto.expiresInDays,
      ipAddress: req.ip || 'unknown',
    });
  }

  /** DELETE /api/api-keys/:id — revoke */
  @Delete(':id')
  @Roles('NIC_ADMIN', 'DEPT_CISO')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.apiKeys.revoke(id, user.orgId, user.id, req.ip || 'unknown');
  }
}
