// ─────────────────────────────────────────────────────────────────
// NCAGP — JWT + RBAC Guards
// File: src/auth/guards/jwt-auth.guard.ts
// 
// SECURITY DESIGN:
//   1. JWT verified with RS256 (asymmetric) — government-grade
//   2. Every request checks session table (revocation support)
//   3. MFA verification state tracked in JWT payload
//   4. org_id injected into every request for RLS enforcement
// ─────────────────────────────────────────────────────────────────

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ROLES_KEY, ORG_SCOPE_KEY } from '../roles.decorator';

// ── JWT Guard ──────────────────────────────────────────────────

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    
    // Enforce MFA for all non-OBSERVER roles
    if (user.role !== 'OBSERVER' && !user.mfaVerified) {
      throw new UnauthorizedException('MFA verification required');
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
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role restriction on this endpoint
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) throw new UnauthorizedException();
    
    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }
    
    return true;
  }
}

// ── Org Scope Guard (Row-Level Security enforcement) ──────────

/**
 * This guard enforces multi-tenancy at the application layer.
 * Even if the DB RLS policy is set, we add defense-in-depth here.
 * 
 * Rules:
 *   NIC_ADMIN    → can access any org
 *   DEPT_CISO    → own org only + assigned vendors
 *   DEPT_SECURITY→ own org only
 *   VENDOR_ADMIN → only orgs they are assigned to audit
 *   AUDITOR      → only active audit assignments
 *   REVIEWER     → only explicitly shared audits
 *   OBSERVER     → only explicitly shared reports
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params, query, body } = request;

    if (!user) throw new UnauthorizedException();

    // NIC_ADMIN sees everything — sovereign root
    if (user.role === 'NIC_ADMIN') return true;

    // Extract target org from request (params, query, or body)
    const targetOrgId =
      params?.orgId ||
      query?.orgId ||
      body?.orgId;

    // If no org context in request, allow (endpoint-level checks handle it)
    if (!targetOrgId) return true;

    // Check if user's org has access to target org
    if (!user.dataAccessScope.includes(targetOrgId) && user.orgId !== targetOrgId) {
      throw new ForbiddenException(
        'Access denied: This resource belongs to a different organization',
      );
    }

    // Inject the verified org context into request
    request.resolvedOrgId = targetOrgId;

    return true;
  }
}
