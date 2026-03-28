'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, LayoutDashboard, AlertTriangle, FileText,
  Building2, Server, BookOpen, LogOut, ChevronRight,
  Lock, Settings, Menu, PanelLeftClose,
} from 'lucide-react';

const NAV = [
  { section: 'Intelligence', items: [
    { href: '/dashboard',     label: 'Risk Heatmap',    icon: LayoutDashboard },
    { href: '/findings',      label: 'Findings',         icon: AlertTriangle   },
  ]},
  { section: 'Evidence & Audit', items: [
    { href: '/evidence',      label: 'Evidence Portal', icon: FileText    },
    { href: '/ledger',        label: 'Audit Ledger',    icon: BookOpen    },
  ]},
  { section: 'Registry', items: [
    { href: '/organizations', label: 'Organizations',   icon: Building2   },
    { href: '/assets',        label: 'Asset Register',  icon: Server      },
  ]},
  { section: 'Security', items: [
    { href: '/settings',      label: 'Settings & MFA',  icon: Settings    },
  ]},
];

const ROLE_COLORS: Record<string, string> = {
  NIC_ADMIN:     '#a78bfa',
  DEPT_CISO:     '#60a5fa',
  DEPT_SECURITY: '#34d399',
  VENDOR_ADMIN:  '#fb923c',
  AUDITOR:       '#fbbf24',
  REVIEWER:      '#94a3b8',
  OBSERVER:      '#64748b',
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
    try { const raw = localStorage.getItem('ncagp_user'); if (raw) setUser(JSON.parse(raw)); } catch {}
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('ncagp_token')}` } });
    } finally {
      localStorage.removeItem('ncagp_token');
      localStorage.removeItem('ncagp_user');
      router.push('/login');
    }
  };

  if (!mounted) return null;

  const roleColor = user ? (ROLE_COLORS[user.role] || '#94a3b8') : '#94a3b8';

  return (
    <aside style={{
      width: collapsed ? 56 : 220,
      minHeight: '100vh',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10,
      transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
      /* Liquid glass sidebar */
      background: 'linear-gradient(180deg, rgba(2,14,32,0.95) 0%, rgba(1,8,18,0.98) 100%)',
      backdropFilter: 'blur(24px) saturate(160%)',
      WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>

      {/* Subtle inner glow */}
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:1, background:'linear-gradient(to bottom, rgba(59,130,246,0.3), transparent 40%)', pointerEvents:'none' }} />

      {/* Logo row */}
      <div style={{ padding:'15px 12px', borderBottom:'1px solid rgba(255,255,255,0.055)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:32, height:32, borderRadius:10, flexShrink:0,
          background:'linear-gradient(135deg, #1d5ce5, #1040b0)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 20px rgba(26,86,219,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
          animation:'sidebarGlow 4s ease-in-out infinite',
        }}>
          <Shield size={16} color="white" />
        </div>
        {!collapsed && (
          <div style={{ flex:1, minWidth:0, animation:'fadeIn 0.2s ease' }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:16, background:'linear-gradient(135deg,#f0f4ff,#93c5fd)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'0.05em' }}>
              NCAGP
            </div>
            <div style={{ fontSize:8.5, color:'rgba(148,163,184,0.3)', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:-1 }}>NIC · Gov of India</div>
          </div>
        )}
        <button onClick={() => setCollapsed(c=>!c)}
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:7, color:'rgba(148,163,184,0.35)', cursor:'pointer', padding:5, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='rgba(148,163,184,0.7)';(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='rgba(148,163,184,0.35)';(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)';}}>
          {collapsed ? <Menu size={13} /> : <PanelLeftClose size={13} />}
        </button>
      </div>

      {/* Clock */}
      {!collapsed && time && (
        <div style={{ padding:'7px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:7 }}>
          <div className="live-dot" />
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'rgba(148,163,184,0.38)', letterSpacing:'0.04em' }}>{time} IST</span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex:1, padding:'6px 8px', overflowY:'auto', overflowX:'hidden' }}>
        {NAV.map(({ section, items }, si) => (
          <div key={section}>
            {!collapsed && (
              <div className="section-label" style={{ animationDelay:`${si*50}ms` }}>{section}</div>
            )}
            {items.map(({ href, label, icon: Icon }, i) => {
              const active = pathname === href || pathname.startsWith(href+'/');
              return (
                <a key={href} href={href} title={collapsed ? label : undefined}
                  className={`nav-item${active ? ' active' : ''}`}
                  style={{ marginBottom:2, justifyContent:collapsed?'center':'flex-start' }}>
                  <Icon size={15} style={{ flexShrink:0, color:active?'#60a5fa':'inherit', transition:'color 0.15s' }} />
                  {!collapsed && (
                    <><span style={{ flex:1 }}>{label}</span>
                    {active && <ChevronRight size={10} style={{ opacity:0.4 }} />}</>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.055)', padding:'10px 8px' }}>
          {!collapsed && (
            <div style={{ padding:'8px 10px 10px' }}>
              {/* Avatar */}
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:`${roleColor}18`, border:`1px solid ${roleColor}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:roleColor }}>
                  {user.name?.slice(0,2).toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'#f0f4ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize:10, color:'rgba(148,163,184,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                </div>
              </div>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', fontFamily:'Rajdhani,sans-serif', padding:'2px 9px', borderRadius:4, background:`${roleColor}12`, color:roleColor, border:`1px solid ${roleColor}28` }}>
                {user.role}
              </span>
            </div>
          )}
          <button onClick={logout} title={collapsed?'Sign out':undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:collapsed?'9px 14px':'8px 10px', justifyContent:collapsed?'center':'flex-start', borderRadius:7, border:'none', cursor:'pointer', background:'transparent', color:'rgba(148,163,184,0.4)', fontSize:13, fontFamily:'IBM Plex Sans,sans-serif', transition:'all 0.15s', whiteSpace:'nowrap' }}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='rgba(239,68,68,0.08)';el.style.color='#f87171';}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='transparent';el.style.color='rgba(148,163,184,0.4)';}}>
            <LogOut size={14} style={{ flexShrink:0 }} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}

      {!collapsed && (
        <div style={{ padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Lock size={8} style={{ color:'rgba(148,163,184,0.18)' }} />
            <span style={{ fontSize:8, color:'rgba(148,163,184,0.18)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Secured · MEITY · GOV.IN</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sidebarGlow{0%,100%{box-shadow:0 0 16px rgba(26,86,219,0.45),inset 0 1px 0 rgba(255,255,255,0.15)}50%{box-shadow:0 0 28px rgba(26,86,219,0.7),inset 0 1px 0 rgba(255,255,255,0.2)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}
      `}</style>
    </aside>
  );
}
