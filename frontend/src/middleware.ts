// ─────────────────────────────────────────────────────────────────
// NCAGP — Next.js Route Protection Middleware
// File: src/middleware.ts
//
// PRD Reference: Sections 3 (Federation) & 4 (Identity & Access)
//
// ENFORCEMENT MAP:
//   /dashboard        → NIC_ADMIN, DEPT_CISO only (global heatmap)
//   /findings         → All authenticated roles
//   /ledger           → NIC_ADMIN, DEPT_CISO, REVIEWER
//   /settings         → All authenticated
//   /organizations    → NIC_ADMIN only
//   /api-keys         → NIC_ADMIN, DEPT_CISO
//   /reports          → NIC_ADMIN, DEPT_CISO, REVIEWER
//   /login            → Public
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

// Routes accessible only to specific roles
// If a role is not listed, that route is forbidden for that role
const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard':     ['NIC_ADMIN'],                                           // PRD §3: NIC sees all / global heatmap — DEPT cannot see global
  '/findings':      ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER','OBSERVER'],
  '/evidence':      ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER'],
  '/ledger':        ['NIC_ADMIN','DEPT_CISO','REVIEWER'],                    // PRD §11: non-repudiation records — restricted
  '/organizations': ['NIC_ADMIN'],                                           // PRD §3: org management — NIC only
  '/assets':        ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR'],
  '/settings':      ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER'],
  '/api-keys':      ['NIC_ADMIN','DEPT_CISO'],                              // Scanner API keys — admin only
  '/reports':       ['NIC_ADMIN','DEPT_CISO','REVIEWER'],
};

// Role → default redirect after login (PRD §4: role-based landing)
const ROLE_HOME: Record<string, string> = {
  NIC_ADMIN:     '/dashboard',
  DEPT_CISO:     '/findings',      // DEPT roles go to findings, not global heatmap
  DEPT_SECURITY: '/findings',
  VENDOR_ADMIN:  '/findings',
  AUDITOR:       '/findings',
  REVIEWER:      '/findings',
  OBSERVER:      '/findings',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public routes — always allow ─────────────────────────────
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // ── Read JWT from cookie (set at login) ──────────────────────
  const token = request.cookies.get('ncagp_token')?.value;
  const userCookie = request.cookies.get('ncagp_user')?.value;

  // No token → redirect to login
  if (!token || !userCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Parse user from cookie
  let user: { role: string; orgId: string } | null = null;
  try {
    user = JSON.parse(decodeURIComponent(userCookie));
  } catch {
    // Corrupt cookie → redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (!user?.role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Find matching route rule ──────────────────────────────────
  const matchedRoute = Object.keys(ROUTE_ROLES).find(route =>
    pathname === route || pathname.startsWith(route + '/')
  );

  if (matchedRoute) {
    const allowedRoles = ROUTE_ROLES[matchedRoute];

    // Role not permitted for this route → redirect to their home
    if (!allowedRoles.includes(user.role)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = ROLE_HOME[user.role] || '/findings';

      // Add a forbidden query param so the page can show a message
      homeUrl.searchParams.set('forbidden', '1');
      return NextResponse.redirect(homeUrl);
    }
  }

  // ── Inject org context into response headers for RLS ─────────
  // The backend already handles RLS via the RlsInterceptor,
  // but we add headers here for any server components that need it
  const response = NextResponse.next();
  response.headers.set('x-ncagp-user-role', user.role);
  response.headers.set('x-ncagp-org-id', user.orgId || '');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
