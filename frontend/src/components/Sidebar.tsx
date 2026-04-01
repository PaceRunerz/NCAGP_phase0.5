'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, LayoutDashboard, AlertTriangle, FileText,
  Building2, Server, BookOpen, LogOut, ChevronRight,
  Lock, Settings, Menu, PanelLeftClose,
} from 'lucide-react';

const NAV = [
  { section:'Intelligence', items:[
    { href:'/dashboard',     label:'Risk Heatmap',   icon:LayoutDashboard },
    { href:'/findings',      label:'Findings',        icon:AlertTriangle   },
  ]},
  { section:'Evidence & Audit', items:[
    { href:'/evidence',      label:'Evidence Portal', icon:FileText   },
    { href:'/ledger',        label:'Audit Ledger',    icon:BookOpen   },
  ]},
  { section:'Registry', items:[
    { href:'/organizations', label:'Organizations',   icon:Building2  },
    { href:'/assets',        label:'Asset Register',  icon:Server     },
  ]},
  { section:'Security', items:[
    { href:'/settings',      label:'Settings & MFA',  icon:Settings   },
  ]},
];

const ROLE_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  NIC_ADMIN:     {bg:'#ede9fe',text:'#7c3aed',border:'#ddd6fe'},
  DEPT_CISO:     {bg:'#eff6ff',text:'#1d4ed8',border:'#bfdbfe'},
  DEPT_SECURITY: {bg:'#f0fdf4',text:'#15803d',border:'#bbf7d0'},
  VENDOR_ADMIN:  {bg:'#fff7ed',text:'#c2410c',border:'#fed7aa'},
  AUDITOR:       {bg:'#fefce8',text:'#a16207',border:'#fde68a'},
  REVIEWER:      {bg:'#f8fafc',text:'#475569',border:'#e2e8f0'},
  OBSERVER:      {bg:'#f8fafc',text:'#94a3b8',border:'#e2e8f0'},
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
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  const logout = async () => {
    try { await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('ncagp_token')}`}}); } finally {
      localStorage.removeItem('ncagp_token'); localStorage.removeItem('ncagp_user'); router.push('/login');
    }
  };

  if (!mounted) return null;
  const rc = user ? (ROLE_COLORS[user.role] || ROLE_COLORS.OBSERVER) : null;

  return (
    <aside style={{
      width: collapsed ? 58 : 224,
      minHeight: '100vh', flexShrink: 0, display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 10,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      background: 'white',
      borderRight: '1px solid #e2e8f0',
      boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
    }}>

      {/* Blue top accent */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#1a56db,#3b82f6)',zIndex:1}} />

      {/* Logo */}
      <div style={{padding:'20px 14px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,#1a56db,#1345b0)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(26,86,219,0.35)'}}>
          <Shield size={17} color="white" />
        </div>
        {!collapsed && (
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:16,color:'#1a56db',letterSpacing:'0.05em'}}>NCAGP</div>
            <div style={{fontSize:8.5,color:'#94a3b8',letterSpacing:'0.14em',textTransform:'uppercase',marginTop:-1}}>NIC · Gov of India</div>
          </div>
        )}
        <button onClick={()=>setCollapsed(c=>!c)} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:7,color:'#94a3b8',cursor:'pointer',padding:5,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}
          onMouseEnter={e=>{(e.currentTarget as any).style.background='#eff6ff';(e.currentTarget as any).style.color='#1a56db';}}
          onMouseLeave={e=>{(e.currentTarget as any).style.background='#f8fafc';(e.currentTarget as any).style.color='#94a3b8';}}>
          {collapsed ? <Menu size={13}/> : <PanelLeftClose size={13}/>}
        </button>
      </div>

      {/* Clock */}
      {!collapsed && time && (
        <div style={{padding:'7px 14px',borderBottom:'1px solid #f8fafc',display:'flex',alignItems:'center',gap:7,background:'#fafbfc'}}>
          <div className="live-dot" style={{background:'#059669'}} />
          <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,color:'#94a3b8',letterSpacing:'0.04em'}}>{time} IST</span>
        </div>
      )}

      {/* Nav */}
      <nav style={{flex:1,padding:'8px',overflowY:'auto',overflowX:'hidden'}}>
        {NAV.map(({section,items},si)=>(
          <div key={section}>
            {!collapsed && <div className="section-label" style={{color:'#cbd5e1'}}>{section}</div>}
            {items.map(({href,label,icon:Icon},i)=>{
              const active = pathname===href || pathname.startsWith(href+'/');
              return (
                <a key={href} href={href} title={collapsed?label:undefined}
                  className={`nav-item${active?' active':''}`}
                  style={{marginBottom:2,justifyContent:collapsed?'center':'flex-start'}}>
                  <Icon size={15} style={{flexShrink:0,color:active?'#1a56db':'#94a3b8',transition:'color 0.15s'}}/>
                  {!collapsed && <><span style={{flex:1,color:active?'#1a56db':'#475569'}}>{label}</span>{active&&<ChevronRight size={10} style={{opacity:0.5,color:'#1a56db'}}/>}</>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div style={{borderTop:'1px solid #f1f5f9',padding:'10px 8px',background:'#fafbfc'}}>
          {!collapsed && (
            <div style={{padding:'8px 10px 10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
                <div style={{width:34,height:34,borderRadius:9,background:rc?.bg,border:`1px solid ${rc?.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12,fontFamily:'Rajdhani,sans-serif',fontWeight:700,color:rc?.text}}>
                  {user.name?.slice(0,2).toUpperCase()||'U'}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
                  <div style={{fontSize:10,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
                </div>
              </div>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:'Rajdhani,sans-serif',padding:'2px 8px',borderRadius:4,background:rc?.bg,color:rc?.text,border:`1px solid ${rc?.border}`}}>
                {user.role}
              </span>
            </div>
          )}
          <button onClick={logout} title={collapsed?'Sign out':undefined}
            style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:collapsed?'9px 14px':'8px 10px',justifyContent:collapsed?'center':'flex-start',borderRadius:7,border:'none',cursor:'pointer',background:'transparent',color:'#94a3b8',fontSize:13,fontFamily:'IBM Plex Sans,sans-serif',transition:'all 0.15s'}}
            onMouseEnter={e=>{const el=e.currentTarget as any;el.style.background='#fef2f2';el.style.color='#dc2626';}}
            onMouseLeave={e=>{const el=e.currentTarget as any;el.style.background='transparent';el.style.color='#94a3b8';}}>
            <LogOut size={14} style={{flexShrink:0}}/>
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      )}

      {!collapsed && (
        <div style={{padding:'8px 14px',borderTop:'1px solid #f1f5f9',background:'#fafbfc'}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <Lock size={8} style={{color:'#cbd5e1'}}/>
            <span style={{fontSize:8,color:'#cbd5e1',letterSpacing:'0.1em',textTransform:'uppercase'}}>Secured · MEITY · GOV.IN</span>
          </div>
        </div>
      )}
    </aside>
  );
}
