'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, LayoutDashboard, AlertTriangle, FileText,
  Building2, Server, BookOpen, LogOut, ChevronRight,
  Activity, Lock, Menu, X, Settings,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard', label: 'Risk Heatmap',    icon: LayoutDashboard },
      { href: '/findings',  label: 'Findings',         icon: AlertTriangle },
    ],
  },
  {
    label: 'Evidence & Audit',
    items: [
      { href: '/evidence', label: 'Evidence Portal', icon: FileText },
      { href: '/ledger',   label: 'Audit Ledger',    icon: BookOpen },
    ],
  },
  {
    label: 'Registry',
    items: [
      { href: '/organizations', label: 'Organizations',  icon: Building2 },
      { href: '/assets',        label: 'Asset Register', icon: Server },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/settings', label: 'Settings & MFA', icon: Settings },
    ],
  },
];

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  NIC_ADMIN:     { label: 'NIC ADMIN',  color: '#a78bfa' },
  DEPT_CISO:     { label: 'DEPT CISO',  color: '#60a5fa' },
  DEPT_SECURITY: { label: 'SECURITY',   color: '#34d399' },
  VENDOR_ADMIN:  { label: 'VENDOR',     color: '#fb923c' },
  AUDITOR:       { label: 'AUDITOR',    color: '#fbbf24' },
  REVIEWER:      { label: 'REVIEWER',   color: '#94a3b8' },
  OBSERVER:      { label: 'OBSERVER',   color: '#64748b' },
};

export function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,      setUser]      = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [time,      setTime]      = useState('');
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem('ncagp_user');
    if (raw) setUser(JSON.parse(raw));

    const tick = () => setTime(
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    );
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

  if (!mounted) return null;

  return (
    <aside style={{
      width: collapsed ? 54 : 218,
      minHeight: '100vh',
      background: 'linear-gradient(180deg, rgba(5,18,34,0.98) 0%, rgba(2,13,26,0.98) 100%)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      backdropFilter: 'blur(16px)',
      position: 'relative', zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{ padding: '15px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #1a56db 0%, #1749c9 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(26,86,219,0.5)',
          animation: 'breathe 4s ease-in-out infinite',
        }}>
          <Shield size={15} color="white" />
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0, animation: 'fadeIn 0.2s ease' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#f1f5f9', letterSpacing: '0.06em' }}>NCAGP</div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>NIC · Gov of India</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.3)', cursor: 'pointer', padding: 3, borderRadius: 4, transition: 'color 0.15s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.7)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.3)'}>
          {collapsed ? <Menu size={14} /> : <X size={14} />}
        </button>
      </div>

      {/* Live clock */}
      {!collapsed && time && (
        <div style={{ padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 7, animation: 'fadeIn 0.3s ease' }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.04em' }}>{time} IST</span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '6px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="section-label" style={{ animationDelay: `${si * 50}ms` }}>
                {section.label}
              </div>
            )}
            {section.items.map(({ href, label, icon: Icon }, i) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <a key={href} href={href} title={collapsed ? label : undefined}
                  className={`nav-item${active ? ' active' : ''}`}
                  style={{
                    marginBottom: 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    animationDelay: `${(si * 4 + i) * 40}ms`,
                  }}>
                  <Icon size={15} style={{ flexShrink: 0, color: active ? '#60a5fa' : 'inherit', transition: 'color 0.15s' }} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
                      {active && <ChevronRight size={10} style={{ opacity: 0.4 }} />}
                    </>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      {user && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 8px' }}>
          {!collapsed && (
            <div style={{ padding: '8px 10px 10px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{user.email}</div>
              {roleConf && (
                <div style={{
                  display: 'inline-block', marginTop: 6,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  fontFamily: 'Rajdhani, sans-serif',
                  padding: '2px 9px', borderRadius: 4,
                  background: `${roleConf.color}15`,
                  color: roleConf.color,
                  border: `1px solid ${roleConf.color}30`,
                }}>
                  {roleConf.label}
                </div>
              )}
            </div>
          )}
          <button onClick={handleLogout} title={collapsed ? 'Sign out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 8, padding: collapsed ? '9px 14px' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 7, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(148,163,184,0.4)',
              fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(239,68,68,0.08)'; el.style.color = '#f87171'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'rgba(148,163,184,0.4)'; }}>
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Lock size={8} style={{ color: 'rgba(148,163,184,0.2)' }} />
            <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Secured · MEITY · GOV.IN
            </span>
          </div>
        </div>
      )}

      <style>{`@keyframes breathe{0%,100%{opacity:0.8;box-shadow:0 0 16px rgba(26,86,219,0.4)}50%{opacity:1;box-shadow:0 0 28px rgba(26,86,219,0.7)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.4);opacity:0}}`}</style>
    </aside>
  );
}
