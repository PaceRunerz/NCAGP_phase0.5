'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, LayoutDashboard, AlertTriangle, FileText,
  Building2, Server, BookOpen, LogOut, ChevronRight,
  Activity, Lock, Menu, X,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard', label: 'Risk Heatmap', icon: LayoutDashboard },
      { href: '/findings', label: 'Findings', icon: AlertTriangle },
    ],
  },
  {
    label: 'Evidence & Audit',
    items: [
      { href: '/evidence', label: 'Evidence Portal', icon: FileText },
      { href: '/ledger', label: 'Audit Ledger', icon: BookOpen },
    ],
  },
  {
    label: 'Registry',
    items: [
      { href: '/organizations', label: 'Organizations', icon: Building2 },
      { href: '/assets', label: 'Asset Register', icon: Server },
    ],
  },
];

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  NIC_ADMIN:     { label: 'NIC ADMIN',    color: '#a78bfa' },
  DEPT_CISO:     { label: 'DEPT CISO',    color: '#60a5fa' },
  DEPT_SECURITY: { label: 'SECURITY',     color: '#34d399' },
  VENDOR_ADMIN:  { label: 'VENDOR',       color: '#fb923c' },
  AUDITOR:       { label: 'AUDITOR',      color: '#fbbf24' },
  REVIEWER:      { label: 'REVIEWER',     color: '#94a3b8' },
  OBSERVER:      { label: 'OBSERVER',     color: '#64748b' },
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState('');

  // Fix hydration: only read localStorage on client
  useEffect(() => {
    const raw = localStorage.getItem('ncagp_user');
    if (raw) setUser(JSON.parse(raw));

    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
      });
    } finally {
      localStorage.removeItem('ncagp_token');
      localStorage.removeItem('ncagp_user');
      router.push('/login');
    }
  };

  const roleConf = user ? (ROLE_CONFIG[user.role] || ROLE_CONFIG.OBSERVER) : null;

  return (
    <aside
      style={{
        width: collapsed ? 56 : 220,
        minHeight: '100vh',
        background: 'rgba(6,21,39,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Logo row */}
      <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: 'linear-gradient(135deg, #1a56db, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(26,86,219,0.4)',
        }}>
          <Shield size={14} color="white" />
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0', letterSpacing: '0.05em' }}>NCAGP</div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>NIC · Gov of India</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.4)', cursor: 'pointer', padding: 2 }}>
          {collapsed ? <Menu size={14} /> : <X size={14} />}
        </button>
      </div>

      {/* Live clock */}
      {!collapsed && time && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: 'rgba(16,185,129,0.25)', animation: 'pulseRing 1.5s ease infinite' }} />
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.05em' }}>{time} IST</span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.3)', padding: '12px 8px 4px' }}>
                {section.label}
              </div>
            )}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <a
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '9px 14px' : '8px 10px',
                    borderRadius: 6, marginBottom: 1,
                    fontWeight: 500, fontSize: 13,
                    textDecoration: 'none', position: 'relative',
                    color: active ? '#e2e8f0' : 'rgba(148,163,184,0.6)',
                    background: active ? 'rgba(26,86,219,0.15)' : 'transparent',
                    border: active ? '1px solid rgba(26,86,219,0.25)' : '1px solid transparent',
                    transition: 'all 0.12s',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {active && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, background: '#1a56db', borderRadius: '0 2px 2px 0' }} />
                  )}
                  <Icon size={14} style={{ flexShrink: 0, color: active ? '#60a5fa' : 'inherit' }} />
                  {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                  {!collapsed && active && <ChevronRight size={10} style={{ opacity: 0.4 }} />}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      {user && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 8px' }}>
          {!collapsed && (
            <div style={{ padding: '8px 10px 10px', marginBottom: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{user.email}</div>
              {roleConf && (
                <div style={{
                  display: 'inline-block', marginTop: 5,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  fontFamily: 'Rajdhani, sans-serif',
                  padding: '2px 8px', borderRadius: 3,
                  background: `${roleConf.color}18`,
                  color: roleConf.color,
                  border: `1px solid ${roleConf.color}30`,
                }}>
                  {roleConf.label}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 8, padding: collapsed ? '9px 14px' : '8px 10px',
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(148,163,184,0.5)',
              fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.5)'; }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}

      {/* NIC branding bottom */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Lock size={9} style={{ color: 'rgba(148,163,184,0.25)' }} />
            <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.05em' }}>
              SECURED · MEITY · GOV.IN
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
