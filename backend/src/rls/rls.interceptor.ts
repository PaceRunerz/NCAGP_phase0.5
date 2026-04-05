// ─────────────────────────────────────────────────────────────────
// NCAGP — Row-Level Security Interceptor
// File: src/rls/rls.interceptor.ts
//
// Sets Postgres session variables before every DB query so that
// the RLS policies in 001_security_hardening.sql can filter rows.
// This is defense-in-depth on top of the app-layer OrgScopeGuard.
// ─────────────────────────────────────────────────────────────────

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.orgId && user?.role) {
      // Set RLS session context for this request's DB connection
      await this.prisma.$executeRaw`
        SELECT 
          set_config('app.current_org_id', ${user.orgId}::text, true),
          set_config('app.current_role', ${user.role}::text, true)
      `;
    }

    return next.handle();
  }
}
