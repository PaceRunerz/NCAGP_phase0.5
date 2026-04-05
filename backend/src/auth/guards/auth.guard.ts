import {
  Injectable, ExecutionContext,
  UnauthorizedException, ForbiddenException, CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../roles.decorator';

// ── JWT Guard ──────────────────────────────────────────────────
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }

    // Get the request path so we can whitelist the MFA verify endpoint
    const request = context.switchToHttp().getRequest();
    const path: string = request.route?.path || request.url || '';

    // THE FIX:
    // /api/auth/mfa/verify is the ONLY endpoint that accepts a partial token
    // (mfaVerified: false). Every other endpoint requires full MFA verification.
    const isMfaVerifyEndpoint = path.includes('/auth/mfa/verify');

    if (!isMfaVerifyEndpoint && user.role !== 'OBSERVER' && !user.mfaVerified) {
      throw new UnauthorizedException('MFA verification required. Please complete 2FA.');
    }

    return user;
  }
}

// ── RBAC Guard ────────────────────────────────────────────────
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY, [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException();
    const hasRole = requiredRoles.some(role => user.role === role);
    if (!hasRole) throw new ForbiddenException(`Access denied. Required: ${requiredRoles.join(', ')}`);
    return true;
  }
}

// ── Org Scope Guard ────────────────────────────────────────────
@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params, query, body } = request;
    if (!user) throw new UnauthorizedException();
    if (user.role === 'NIC_ADMIN') return true;
    const targetOrgId = params?.orgId || query?.orgId || body?.orgId;
    if (!targetOrgId) return true;
    if (!user.dataAccessScope?.includes(targetOrgId) && user.orgId !== targetOrgId) {
      throw new ForbiddenException('Access denied: Different organisation');
    }
    request.resolvedOrgId = targetOrgId;
    return true;
  }
}
