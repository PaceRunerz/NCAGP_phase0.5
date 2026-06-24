import { NextRequest, NextResponse } from 'next/server';

const ROLE_HOME: Record<string, string> = {
  NIC_ADMIN:     '/dashboard',
  DEPT_CISO:     '/dept-dashboard',
  DEPT_SECURITY: '/dept-dashboard',
  VENDOR_ADMIN:  '/audit-dashboard',  
  AUDITOR:       '/audit-dashboard',
  REVIEWER:      '/review-dashboard',  dfvef
  OBSERVER:      '/review-dashboard',
};

const ROLE_ALLOWED: Record<string, string[]> = {
  '/dashboard':       ['NIC_ADMIN'],
  '/dept-dashboard':  ['DEPT_CISO','DEPT_SECURITY'],
  '/audit-dashboard': ['VENDOR_ADMIN','AUDITOR'],
  '/review-dashboard':['REVIEWER','OBSERVER'],
  '/findings':        ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER','OBSERVER'],
  '/evidence':        ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER'],
  '/ledger':          ['NIC_ADMIN','DEPT_CISO','REVIEWER'],
  '/organizations':   ['NIC_ADMIN'],
  '/assets':          ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR'],
  '/settings':        ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','VENDOR_ADMIN','AUDITOR','REVIEWER'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Login page — if already authenticated, redirect to their home
  if (pathname === '/login') {
    const token = request.cookies.get('ncagp_token')?.value;
    const userCookie = request.cookies.get('ncagp_user')?.value;
    if (token && userCookie) {
      try {
        const user = JSON.parse(decodeURIComponent(userCookie));
        const home = ROLE_HOME[user.role] || '/login';
        if (home !== '/login') {
          return NextResponse.redirect(new URL(home, request.url));
        }
      } catch {}
    }
    return NextResponse.next();
  }

  // Every other route requires a valid token cookie
  const token    = request.cookies.get('ncagp_token')?.value;
  const userRaw  = request.cookies.get('ncagp_user')?.value;

  // No token → send to login, remember where they wanted to go
  if (!token || !userRaw) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    // Clear any stale cookies
    res.cookies.delete('ncagp_token');
    res.cookies.delete('ncagp_user');
    return res;
  }

  // Parse user from cookie
  let user: any = null;
  try {
    user = JSON.parse(decodeURIComponent(userRaw));
  } catch {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!user?.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based route protection
  const matchedRoute = Object.keys(ROLE_ALLOWED).find(
    route => pathname === route || pathname.startsWith(route + '/')
  );

  if (matchedRoute) {
    const allowed = ROLE_ALLOWED[matchedRoute];
    if (!allowed.includes(user.role)) {
      // Redirect to their actual home, not a 403
      const home = ROLE_HOME[user.role] || '/login';
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  // Pass org context to backend via headers
  const res = NextResponse.next();
  res.headers.set('x-ncagp-role',   user.role);
  res.headers.set('x-ncagp-org-id', user.orgId || '');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
