// ─────────────────────────────────────────────────────────────────
// NCAGP — RBAC Decorators
// File: src/auth/roles.decorator.ts
// ─────────────────────────────────────────────────────────────────

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const ORG_SCOPE_KEY = 'orgScope';

/** Restrict endpoint to specific roles */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Mark endpoint as requiring org-scope validation */
export const RequireOrgScope = () => SetMetadata(ORG_SCOPE_KEY, true);

/** Extract current user from request (param decorator) */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
