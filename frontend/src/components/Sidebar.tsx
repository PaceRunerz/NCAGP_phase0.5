'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; stgtbga
import {
  Shield, LayoutDashboard, AlertTriangle, FileText,
  Building2, Server, BookOpen, LogOut, ChevronRight,
  Lock, Settings, Menu, PanelLeftClose, Eye,
  ClipboardList, Search, Upload, BarChart3,
} from 'lucide-react';

// ── Each role sees ONLY their relevant nav items ────────────────
// PRD §3 + §4: federation rules enforced in UI
const ROLE_NAV: Record<string, { section: string; items: { href: string; label: string; icon: any }[] }[]> = {

  NIC_ADMIN: [
    { section: 'Intelligence', items: [
      { href: '/dashboard',      label: 'National Heatmap',  icon: LayoutDashboard },
      { href: '/findings',       label: 'All Findings',       icon: AlertTriangle   },
    ]},
    { section: 'Evidence & Audit', items: [
      { href: '/evidence',       label: 'Evidence Portal',   icon: FileText    },
      { href: '/ledger',         label: 'Audit Ledger',      icon: BookOpen    },
    ]},
    { section: 'Registry', items: [
      { href: '/organizations',  label: 'Organizations',     icon: Building2   },
      { href: '/assets',         label: 'Asset Register',    icon: Server      },
    ]},
    { section: 'Admin', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings    },
    ]},
  ],

  DEPT_CISO: [
    { section: 'My Department', items: [
      { href: '/dept-dashboard', label: 'CISO Overview',     icon: BarChart3   },
      { href: '/findings',       label: 'Dept Findings',     icon: AlertTriangle },
    ]},
    { section: 'Operations', items: [
      { href: '/evidence',       label: 'Evidence Portal',   icon: FileText    },
      { href: '/assets',         label: 'Asset Register',    icon: Server      },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings    },
    ]},
  ],

  DEPT_SECURITY: [
    { section: 'My Work', items: [
      { href: '/dept-dashboard', label: 'Security Ops',      icon: Shield      },
      { href: '/findings',       label: 'Dept Findings',     icon: AlertTriangle },
    ]},
    { section: 'Actions', items: [
      { href: '/evidence',       label: 'Upload Evidence',   icon: Upload      },
      { href: '/assets',         label: 'Asset Register',    icon: Server      },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings    },
    ]},
  ],

  VENDOR_ADMIN: [
    { section: 'My Audits', items: [
      { href: '/audit-dashboard',label: 'Audit Overview',    icon: ClipboardList },
      { href: '/findings',       label: 'Submit Findings',   icon: AlertTriangle },
    ]},
    { section: 'Validate', items: [
      { href: '/evidence',       label: 'Review Evidence',   icon: FileText    },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings    },
    ]},
  ],

  AUDITOR: [
    { section: 'My Work', items: [
      { href: '/audit-dashboard',label: 'Audit Workspace',   icon: Search      },
      { href: '/findings',       label: 'Findings',          icon: AlertTriangle },
    ]},
    { section: 'Evidence', items: [
      { href: '/evidence',       label: 'Review Evidence',   icon: FileText    },
    ]},
    { section: 'Account', items: [
      { href: '/settings',       label: 'Settings & MFA',    icon: Settings    },
    ]},
  ],

  REVIEWER: [
    { section: 'Review', items: [
      { href: '/review-dashboard',label: 'Review Dashboard', icon: BarChart3   },
      { href: '/findings',        label: 'View Findings',    icon: AlertTriangle },
    ]},
    { section: 'Audit Trail', items: [
      { href: '/ledger',          label: 'Audit Ledger',     icon: BookOpen    },
    ]},
    { section: 'Account', items: [
      { href: '/settings',        label: 'Settings',         icon: Settings    },
    ]},
  ],

  OBSERVER: [
    { section: 'View Only', items: [
      { href: '/review-dashboard',label: 'Observer View',    icon: Eye         },
      { href: '/findings',        label: 'View Findings',    icon: AlertTriangle },
    ]},
  ],
};

const ROLE_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  NIC_ADMIN:     { bg:'rgba(167,139,250,0.12)', text:'#a78bfa', border:'rgba(167,139,250,0.3)' },
  DEPT_CISO:     { bg:'rgba(59,130,246,0.12)',  text:'#60a5fa', border:'rgba(59,130,246,0.3)'  },
  DEPT_SECURITY: { bg:'rgba(52,211,153,0.12)',  text:'#34d399', border:'rgba(52,211,153,0.3)'  },
  VENDOR_ADMIN:  { bg:'rgba(251,146,60,0.12)',  text:'#fb923c', border:'rgba(251,146,60,0.3)'  },
  AUDITOR:       { bg:'rgba(251,191,36,0.12)',  text:'#fbbf24', border:'rgba(251,191,36,0.3)'  },
  REVIEWER:      { bg:'rgba(148,163,184,0.1)',  text:'#94a3b8', border:'rgba(148,163,184,0.25)'},
  OBSERVER:      { bg:'rgba(100,116,139,0.1)',  text:'#64748b', border:'rgba(100,116,139,0.2)' },
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
    try { const r = localStorage.getItem('ncagp_user'); if (r) setUser(JSON.parse(r)); } catch {}
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN',{ hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }));
    tick(); const id = setInterval(tick,1000); return () => clearInterval(id);
  },[]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
      });
    } finally {
      // Clear localStorage
      localStorage.removeItem('ncagp_token');
      localStorage.removeItem('ncagp_user');
      // Clear cookies — middleware reads these for route protection
      document.cookie = 'ncagp_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
      document.cookie = 'ncagp_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict';
      // Hard navigate so Next.js middleware re-evaluates from scratch
      window.location.href = '/login';
    }
  };

  if (!mounted) return null;

  const role   = user?.role || 'OBSERVER';
  const nav    = ROLE_NAV[role] || ROLE_NAV.OBSERVER;
  const rc     = ROLE_COLORS[role] || ROLE_COLORS.OBSERVER;

  return (
    <aside style={{
      width: collapsed ? 58 : 224,
      minHeight: '100vh', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 10,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      background: 'linear-gradient(180deg,rgba(2,14,32,0.98),rgba(1,8,18,0.99))',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Accent line */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#1a56db,#3b82f6)', zIndex:1 }}/>
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:1, background:'linear-gradient(to bottom,rgba(59,130,246,0.3),transparent 40%)', pointerEvents:'none' }}/>

      {/* Logo */}
      <div style={{ padding:'20px 12px 14px', borderBottom:'1px solid rgba(255,255,255,0.055)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#1a56db,#1345b0)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(26,86,219,0.55)', animation:'sidebarGlow 4s ease-in-out infinite' }}>
          <Shield size={16} color="white"/>
        </div>
        {!collapsed && (
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:16, background:'linear-gradient(135deg,#f0f4ff,#93c5fd)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', letterSpacing:'0.05em' }}>NCAGP</div>
            <div style={{ fontSize:8.5, color:'rgba(148,163,184,0.3)', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:-1 }}>NIC · Gov of India</div>
          </div>
        )}
        <button onClick={()=>setCollapsed(c=>!c)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:7, color:'rgba(148,163,184,0.35)', cursor:'pointer', padding:5, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
          onMouseEnter={e=>{(e.currentTarget as any).style.color='rgba(148,163,184,0.7)';}}
          onMouseLeave={e=>{(e.currentTarget as any).style.color='rgba(148,163,184,0.35)';}}>
          {collapsed ? <Menu size={13}/> : <PanelLeftClose size={13}/>}
        </button>
      </div>

      {/* Clock */}
      {!collapsed && time && (
        <div style={{ padding:'7px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,0.1)' }}>
          <div className="live-dot"/>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'rgba(148,163,184,0.38)', letterSpacing:'0.04em' }}>{time} IST</span>
        </div>
      )}

      {/* Role nav — only role-specific items */}
      <nav style={{ flex:1, padding:'8px', overflowY:'auto', overflowX:'hidden' }}>
        {nav.map(({ section, items }) => (
          <div key={section}>
            {!collapsed && (
              <div className="section-label">{section}</div>
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href+'/');
              return (
                <a key={href} href={href} title={collapsed ? label : undefined}
                  className={`nav-item${active ? ' active' : ''}`}
                  style={{ marginBottom:2, justifyContent:collapsed?'center':'flex-start' }}>
                  <Icon size={15} style={{ flexShrink:0, color:active?'#60a5fa':'rgba(148,163,184,0.5)', transition:'color 0.15s' }}/>
                  {!collapsed && (
                    <><span style={{ flex:1 }}>{label}</span>{active && <ChevronRight size={10} style={{ opacity:0.4 }}/>}</>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User section */}
      {user && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.055)', padding:'10px 8px' }}>
          {!collapsed && (
            <div style={{ padding:'8px 10px 10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:rc.bg, border:`1px solid ${rc.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:rc.text }}>
                  {user.name?.slice(0,2).toUpperCase()||'U'}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f0f4ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize:10, color:'rgba(148,163,184,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                </div>
              </div>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', fontFamily:'Rajdhani,sans-serif', padding:'2px 8px', borderRadius:4, background:rc.bg, color:rc.text, border:`1px solid ${rc.border}` }}>
                {role.replace('_',' ')}
              </span>
            </div>
          )}
          <button onClick={logout} title={collapsed?'Sign out':undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:collapsed?'9px 14px':'8px 10px', justifyContent:collapsed?'center':'flex-start', borderRadius:7, border:'none', cursor:'pointer', background:'transparent', color:'rgba(148,163,184,0.4)', fontSize:13, fontFamily:'IBM Plex Sans,sans-serif', transition:'all 0.15s' }}
            onMouseEnter={e=>{const el=e.currentTarget as any;el.style.background='rgba(239,68,68,0.08)';el.style.color='#f87171';}}
            onMouseLeave={e=>{const el=e.currentTarget as any;el.style.background='transparent';el.style.color='rgba(148,163,184,0.4)';}}>
            <LogOut size={14} style={{ flexShrink:0 }}/>
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}

      {!collapsed && (
        <div style={{ padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Lock size={8} style={{ color:'rgba(148,163,184,0.18)' }}/>
            <span style={{ fontSize:8, color:'rgba(148,163,184,0.18)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Secured · MEITY · GOV.IN</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sidebarGlow{0%,100%{box-shadow:0 0 16px rgba(26,86,219,0.45),inset 0 1px 0 rgba(255,255,255,0.15)}50%{box-shadow:0 0 28px rgba(26,86,219,0.7),inset 0 1px 0 rgba(255,255,255,0.2)}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}
      `}</style>
    </aside>
  );
}
