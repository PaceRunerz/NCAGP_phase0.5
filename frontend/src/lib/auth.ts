// ─────────────────────────────────────────────────────────────────
// NCAGP — Auth Utilities
// File: src/lib/auth.ts
//
// Stores token in BOTH localStorage (for API calls) AND
// httpOnly-free cookie (for middleware route protection).
// ─────────────────────────────────────────────────────────────────

export function saveAuth(token: string, user: object) {
  // localStorage — for Bearer token in API calls
  localStorage.setItem('ncagp_token', token);
  localStorage.setItem('ncagp_user', JSON.stringify(user));

  // Cookie — for Next.js middleware to read (not httpOnly so JS can set it)
  // Expires in 8 hours matching JWT expiry
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
  document.cookie = `ncagp_token=${token}; expires=${expires}; path=/; SameSite=Strict`;
  document.cookie = `ncagp_user=${encodeURIComponent(JSON.stringify(user))}; expires=${expires}; path=/; SameSite=Strict`;
}

export function clearAuth() {
  localStorage.removeItem('ncagp_token');
  localStorage.removeItem('ncagp_user');
  // Clear cookies
  document.cookie = 'ncagp_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'ncagp_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ncagp_token');
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ncagp_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// Role permission checks — mirrors ROUTE_ROLES in middleware.ts
export const CAN = {
  seeGlobalHeatmap: (role: string) => role === 'NIC_ADMIN',
  manageOrgs:       (role: string) => role === 'NIC_ADMIN',
  createFindings:   (role: string) => ['NIC_ADMIN','AUDITOR','VENDOR_ADMIN'].includes(role),
  uploadEvidence:   (role: string) => ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN'].includes(role),
  approveClosures:  (role: string) => ['NIC_ADMIN','DEPT_CISO'].includes(role),      // PRD §9 Step 5
  validateEvidence: (role: string) => ['NIC_ADMIN','AUDITOR','VENDOR_ADMIN'].includes(role), // PRD §9 Step 4
  manageApiKeys:    (role: string) => ['NIC_ADMIN','DEPT_CISO'].includes(role),
  accessLedger:     (role: string) => ['NIC_ADMIN','DEPT_CISO','REVIEWER'].includes(role),
  downloadReports:  (role: string) => ['NIC_ADMIN','DEPT_CISO','REVIEWER'].includes(role),
};
