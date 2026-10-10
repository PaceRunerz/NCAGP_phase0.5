// ─────────────────────────────────────────────────────────────────
// NCAGP — JWT RS256 Strategy
// File: src/auth/strategies/jwt.strategy.ts
//
// Uses RS256 (asymmetric) — server only needs public key to verify.
// Each request also checks session table for revocation support.
// ─────────────────────────────────────────────────────────────────

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;        // User ID
  email: string;
  role: string;
  orgId: string;
  dataAccessScope: string[];
  mfaVerified: boolean;
  sessionId: string;  // Used for revocation check
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_PUBLIC_KEY')!,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Check session is still valid (supports logout/revocation)
    const tokenHash = crypto
      .createHash('sha256')
      .update(payload.sessionId)
      .digest('hex');

    const session = await this.prisma.session.findFirst({
      where: {
        token: tokenHash,
        userId: payload.sub,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Return user context — attached to request.user
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId,
      dataAccessScope: payload.dataAccessScope,
      mfaVerified: payload.mfaVerified,
      sessionId: payload.sessionId,
    };
  }
}
