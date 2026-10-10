// ─────────────────────────────────────────────────────────────────
// SYNC — Auth Controller
// File: src/auth/auth.controller.ts
// ─────────────────────────────────────────────────────────────────

import {
  Controller, Post, Get, Body, Req, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsIn } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/auth.guard';
import { CurrentUser } from './roles.decorator';
import { Throttle } from '@nestjs/throttler';

// ── DTOs ──────────────────────────────────────────────────────

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // 🛡️ CAPTCHA Fields Required by Frontend
  @IsString()
  recaptchaToken: string;

  @IsIn(['v2', 'v3'])
  recaptchaVersion: 'v2' | 'v3';
}

class MfaDto {
  @IsString()
  @MinLength(6)
  totpCode: string;
}

// ── Controller ────────────────────────────────────────────────

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 login attempts per minute
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto.email,
      dto.password,
      dto.recaptchaToken,   
      dto.recaptchaVersion, 
      req.ip || 'unknown',
      req.headers['user-agent'] || 'unknown',
    );
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async verifyMfa(
    @Body() dto: MfaDto,
    @CurrentUser() user: any,
  ) {
    return this.authService.verifyMfa(
      user.id,
      user.orgId,
      dto.totpCode,
      user.sessionId,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: any, @Req() req: Request) {
    return this.authService.logout(user.id, user.sessionId, req.ip || 'unknown');
  }

  // ── NEW MFA Endpoints ────────────────────────────────────────

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  async mfaStatus(@CurrentUser() user: any) {
    // FIXED: Changed user.sub to user.id
    const dbUser = await this.authService.findUserById(user.id);
    return {
      mfaEnabled: dbUser?.mfaEnabled || false,
      userId: user.id,
    };
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@CurrentUser() user: any) {
    // FIXED: Changed user.sub to user.id
    return this.authService.initMfa(user.id);
  }
}