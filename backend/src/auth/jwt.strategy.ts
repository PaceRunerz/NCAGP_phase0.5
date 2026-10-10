import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_ncagp_key_2026_do_not_share',
    });
  }

  async validate(payload: any) {
    // Attached to request.user — shape must match @CurrentUser() usage across controllers (user.id, not userId)
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId,
      dataAccessScope: payload.dataAccessScope ?? [],
      mfaVerified: payload.mfaVerified ?? true,
      sessionId: payload.sessionId,
    };
  }
}