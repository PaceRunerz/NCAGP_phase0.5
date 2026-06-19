'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, Activity, Target, Zap, Shield, ClipboardList,
} from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';




const SEV_COLOR: Record<string,string> = {
  CRITICAL:'#f87171', HIGH:'#fb923c', MEDIUM:'#fbbf24', LOW:'#94a3b8', INFO:'#60a5fa'
};
const STATUS_COLOR: Record<string,string> = {
  OPEN:'#f87171', ACKNOWLEDGED:'#fbbf24', IN_REMEDIATION:'#60a5fa',
  REMEDIATED_PENDING_VALIDATION:'#34d399', VALIDATED:'#4ade80', CLOSED:'#475569',
};

// PRD §9: The 5-step workflow
const WORKFLOW_STEPS = [
  { step:1, label:'Submit Finding',        who:'You',        color:'#60a5fa', yours:true  },
  { step:2, label:'Dept Fixes Issue',      who:'Dept Team',  color:'#94a3b8', yours:false },
  { step:3, label:'Dept Uploads Proof',    who:'Dept Team',  color:'#94a3b8', yours:false },
  { step:4, label:'You Validate Evidence', who:'You',        color:'#34d399', yours:true  },
  { step:5, label:'NIC Approves Closure',  who:'NIC Admin',  color:'#a78bfa', yours:false },
];

export default function AuditDashboard() {
  const [user, setUser] = useState<any>(null);
  const [searchQ, setSearchQ] = useState('');
  const [highlightOrg, setHighlightOrg] = useState('');

  useEffect(()=>{ try{setUser(JSON.parse(localStorage.getItem('ncagp_user')||'{}'))}catch{} },[]);

  const { data, loading, refresh } = useData<any>(
    useCallback(()=>apiFetch('/api/findings?limit=200'),[]),
    [], { refreshOnFocus:true, refreshOnVisible:true }
  );

  const all     = data?.findings || [];
  const pending = all.filter((f:any)=>f.status==='REMEDIATED_PENDING_VALIDATION');
  const open    = all.filter((f:any)=>f.status==='OPEN');
  const closed  = all.filter((f:any)=>f.status==='CLOSED');
  const critical= all.filter((f:any)=>f.severity==='CRITICAL'&&f.status!=='CLOSED');
  const breached= all.filter((f:any)=>f.slaBreached&&f.status!=='CLOSED');

  const fmtDate = (d:string) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—';

  // Process data for the Risk Heatmap
  const orgRisk = all.reduce((acc:any, f:any) => {
    const org = f.org?.shortCode || 'Other';
    if (!acc[org]) acc[org] = { name: org, critical: 0, high: 0, open: 0 };
    if (f.status !== 'CLOSED') acc[org].open++;
    if (f.severity === 'CRITICAL' && f.status !== 'CLOSED') acc[org].critical++;
    if (f.severity === 'HIGH' && f.status !== 'CLOSED') acc[org].high++;
    return acc;
  }, {});

  // Search Logic
  const matchedOrgs = searchQ ? Object.keys(orgRisk).filter(o => o.toLowerCase().includes(searchQ.toLowerCase())) : [];

  const handleSearchClick = (org: string) => {
    setSearchQ('');
    setHighlightOrg(org);
    // Remove highlight after 2 seconds
    setTimeout(() => setHighlightOrg(''), 2000);
    // Scroll to the tile smoothly
    const el = document.getElementById(`risk-tile-${org}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="p-6 relative" style={{ zIndex: 1 }}>

      {/* Header */}
      <div className="anim-fade-up flex items-start justify-between" style={{ marginBottom: 24 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <Search size={18} color="#fbbf24"/>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Rajdhani,sans-serif' }} className="text-[22px] font-bold text-[var(--text-primary)]">Audit Workspace</h1>
            <p style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }} className="text-[11px] text-[var(--text-secondary)]">
              {user?.name} · AUDITOR · {user?.orgName || 'CredSec Technologies'}
            </p>
          </div>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <button onClick={refresh} className="btn btn-ghost text-[11px]"><RefreshCw size={11}/>Refresh</button>
          <a href="/findings" className="btn btn-primary text-[11px]" style={{ textDecoration: 'none' }}><Plus size={11}/>New Finding</a>
        </div>
      </div>

      {/* KPIs */}
      <div className="stagger grid grid-cols-4" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { label:'Awaiting Validation', value:pending.length, sub:'Evidence uploaded, needs review', color:'#34d399', accent:'#10b981', icon:<CheckCircle2 size={32}/> },
          { label:'Open Findings',       value:open.length,    sub:'Department yet to fix',           color:'#f87171', accent:'#ef4444', icon:<AlertTriangle size={32}/> },
          { label:'Critical Unresolved', value:critical.length,sub:'P0 — needs immediate push',       color:'#f87171', accent:'#ef4444', icon:<Zap size={32}/> },
          { label:'Fully Closed',        value:closed.length,  sub:'NIC approved closure',            color:'#4ade80', accent:'#10b981', icon:<Shield size={32}/> },
        ].map(({ label, value, sub, color, accent, icon }) => (
          <div key={label} className="stat-card anim-fade-up" style={{ '--accent-line':`linear-gradient(90deg,transparent,${accent}60,transparent)` } as any}>
            <div style={{ position:'absolute', top:18, right:18, color:accent+'25' }}>{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Department Risk Heatmap with Search */}
      <div className="glass-card p-5 mb-5">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Activity size={14} color="#f87171"/>
            <span style={{ fontFamily: 'Rajdhani,sans-serif' }} className="text-[14px] font-bold text-[var(--text-primary)]">Department Risk Heatmap</span>
            <span style={{ fontSize: 9, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 3, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', marginLeft: 4 }} className="text-[9px] font-bold">LIVE</span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
            <input type="text" placeholder="Search org..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="gov-input" style={{ padding: '6px 10px 6px 28px', width: 180 }} />
            {searchQ && (
              <div style={{ position: 'absolute', top: '100%', right: 0, width: 220, background: 'var(--bg-surface)', border: '1px solid var(--card-border)', borderRadius: 6, marginTop: 4, zIndex: 20, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', fontFamily: 'Rajdhani,sans-serif', fontWeight: 700 }}>
                  {matchedOrgs.length} MATCHES FOUND
                </div>
                {matchedOrgs.length === 0 ? (
                  <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-secondary)' }}>No organizations found.</div>
                ) : (
                  matchedOrgs.map(org => (
                    <div key={org} onClick={() => handleSearchClick(org)} style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)' }} onMouseEnter={e=>(e.currentTarget as any).style.background='var(--bg-main)'} onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
                      {org}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="flex" style={{ gap: 10 }}>{[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:70, width:140, borderRadius:8 }}/>)}</div>
        ) : Object.keys(orgRisk).length === 0 ? (
           <div style={{ fontSize:12, color:'var(--text-secondary)' }}>No risk data available yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
            {Object.entries(orgRisk).map(([org, stats]: any) => {
              const isCritical = stats.critical > 0;
              const isHigh = stats.high > 0 && !isCritical;
              const isSafe = stats.open === 0;
              
              const color = isCritical ? '#f87171' : isHigh ? '#fbbf24' : isSafe ? '#4ade80' : '#60a5fa';
              const bg = isCritical ? 'rgba(239,68,68,0.08)' : isHigh ? 'rgba(245,158,11,0.08)' : isSafe ? 'rgba(74,222,128,0.08)' : 'rgba(59,130,246,0.08)';

              return (
                <div key={org} id={`risk-tile-${org}`} className={`risk-tile ${highlightOrg === org ? 'tile-highlight' : ''}`} style={{ padding: 12, borderRadius: 8, border: `1px solid ${color}40`, background: bg, display: 'flex', flexDirection: 'column', gap: 4, transition: 'all 0.3s' }}>
                  <div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono,monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{org}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{stats.open} Open Findings</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {stats.critical > 0 && <span style={{ fontSize: 9, background: '#f8717120', color: '#f87171', padding: '2px 4px', borderRadius: 3 }}>{stats.critical} CRIT</span>}
                    {stats.high > 0 && <span style={{ fontSize: 9, background: '#fbbf2420', color: '#fbbf24', padding: '2px 4px', borderRadius: 3 }}>{stats.high} HIGH</span>}
                    {isSafe && <span style={{ fontSize: 9, background: '#4ade8020', color: '#4ade80', padding: '2px 4px', borderRadius: 3 }}>SECURE</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workflow pipeline */}
      <div className="glass-card" style={{ padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <Activity size={14} color="#60a5fa"/>
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>Your Role in the Audit Workflow</span>
          <span style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.08em', padding:'2px 7px', borderRadius:3, background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.25)', marginLeft:4 }}>PRD §9</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {WORKFLOW_STEPS.map(({ step, label, who, color, yours }) => (
            <div key={step} style={{ background:yours?`${color}12`:'rgba(255,255,255,0.02)', border:`1px solid ${yours?color+'35':'rgba(255,255,255,0.05)'}`, borderRadius:9, padding:12, position:'relative' }}>
              {yours && <div style={{ position:'absolute', top:8, right:8, width:7, height:7, borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}` }}/>}
              <div style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', color:yours?color:'rgba(148,163,184,0.3)', marginBottom:5 }}>STEP {step}</div>
              <div style={{ fontSize:12, fontWeight:600, color:yours?'var(--text-primary)':'var(--text-secondary)', lineHeight:1.3, marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:yours?color:'rgba(148,163,184,0.25)', letterSpacing:'0.05em' }}>
                {yours ? '← YOUR ACTION' : who}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Validation queue — the auditor's main action item */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <Target size={14} color="#34d399"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>Evidence Validation Queue</span>
            {pending.length > 0 && (
              <span style={{ marginLeft:'auto', fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, padding:'2px 7px', borderRadius:3, background:'rgba(52,211,153,0.15)', color:'#34d399', border:'1px solid rgba(52,211,153,0.3)', animation:'borderPulse 2s ease-in-out infinite' }}>
                {pending.length} NEED REVIEW
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:52 }}/>)}</div>
          ) : pending.length === 0 ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:'rgba(148,163,184,0.3)' }}>
              <CheckCircle2 size={32} style={{ margin:'0 auto 10px', display:'block', opacity:0.15 }}/>
              <div style={{ fontSize:13, fontFamily:'Rajdhani,sans-serif', color:'var(--text-secondary)' }}>All caught up!</div>
              <div style={{ fontSize:11, marginTop:4, color:'var(--text-secondary)' }}>No findings awaiting your validation</div>
            </div>
          ) : pending.slice(0,6).map((f:any)=>(
            <a key={f.id} href="/findings" style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:8, marginBottom:7, cursor:'pointer', textDecoration:'none', transition:'border-color 0.15s' }}
              onMouseEnter={e=>(e.currentTarget as any).style.borderColor='rgba(52,211,153,0.4)'}
              onMouseLeave={e=>(e.currentTarget as any).style.borderColor='rgba(52,211,153,0.15)'}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:SEV_COLOR[f.severity]||'#94a3b8', flexShrink:0, marginTop:3 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>
                  {f.org?.shortCode} · {f._count?.evidence||0} files · SLA {fmtDate(f.slaDate)}
                </div>
              </div>
              <span style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, padding:'2px 7px', borderRadius:3, background:'rgba(52,211,153,0.15)', color:'#34d399', border:'1px solid rgba(52,211,153,0.25)', flexShrink:0, whiteSpace:'nowrap' }}>VALIDATE →</span>
            </a>
          ))}
          {pending.length > 6 && (
            <a href="/findings" style={{ display:'block', textAlign:'center', fontSize:11, color:'#60a5fa', textDecoration:'none', marginTop:6, fontFamily:'Rajdhani,sans-serif', fontWeight:700 }}>
              +{pending.length - 6} more →
            </a>
          )}
        </div>

        {/* SLA breach tracking */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <Clock size={14} color="#f87171"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>SLA Breach Tracker</span>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <div style={{ flex:1, padding:'12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:28, color:'#f87171' }}>{breached.length}</div>
              <div style={{ fontSize:9, color:'rgba(239,68,68,0.6)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>Breached</div>
            </div>
            <div style={{ flex:1, padding:'12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:28, color:'#fbbf24' }}>{open.length}</div>
              <div style={{ fontSize:9, color:'rgba(245,158,11,0.6)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>Open</div>
            </div>
            <div style={{ flex:1, padding:'12px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:28, color:'#34d399' }}>{closed.length}</div>
              <div style={{ fontSize:9, color:'rgba(52,211,153,0.6)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>Closed</div>
            </div>
          </div>
          {breached.slice(0,4).map((f:any) => {
            const daysOver = Math.floor((Date.now()-new Date(f.slaDate).getTime())/86400000);
            return (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.12)', borderRadius:7, marginBottom:6 }}>
                <Clock size={10} color="#f87171" style={{ flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                </div>
                <span style={{ fontSize:10, color:'#f87171', fontFamily:'IBM Plex Mono,monospace', flexShrink:0 }}>{daysOver}d over</span>
              </div>
            );
          })}
          {breached.length === 0 && (
            <div style={{ textAlign:'center', padding:'16px 0', color:'rgba(52,211,153,0.4)', fontSize:12 }}>
              ✓ No SLA breaches — good standing
            </div>
          )}
        </div>
      </div>

      {/* Recent findings table */}
      <div className="glass-card">
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ClipboardList size={14} color="#60a5fa"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>All Findings</span>
            <span style={{ fontSize:10, color:'var(--text-secondary)', fontFamily:'IBM Plex Mono,monospace' }}>{all.length} total</span>
          </div>
          <a href="/findings" className="btn btn-ghost" style={{ fontSize:10, padding:'5px 12px', textDecoration:'none' }}>View All →</a>
        </div>
        {loading ? (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>{[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{ height:44 }}/>)}</div>
        ) : (
          <table className="gov-table">
            <thead><tr><th>Severity</th><th>Title</th><th>Org</th><th>Status</th><th>SLA</th><th>Evidence</th></tr></thead>
            <tbody>
              {all.length===0 ? (
                <tr><td colSpan={6} style={{ padding:'40px 0', textAlign:'center' }}>
                  <div style={{ color:'var(--text-secondary)', marginBottom:12, fontSize:13 }}>No findings yet</div>
                  <a href="/findings" className="btn btn-primary" style={{ display:'inline-flex', textDecoration:'none', fontSize:11 }}>
                    <Plus size={12}/>Create First Finding
                  </a>
                </td></tr>
              ) : all.slice(0,10).map((f:any)=>(
                <tr key={f.id} style={{ cursor:'pointer' }} onClick={()=>window.location.href='/findings'}>
                  <td><span style={{ display:'inline-flex', padding:'2px 7px', borderRadius:4, fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, background:`${SEV_COLOR[f.severity]}15`, color:SEV_COLOR[f.severity], border:`1px solid ${SEV_COLOR[f.severity]}30` }}>{f.severity}</span></td>
                  <td><div style={{ fontSize:12, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{f.title}</div></td>
                  <td><span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'var(--text-secondary)' }}>{f.org?.shortCode}</span></td>
                  <td><span style={{ fontSize:11, fontFamily:'Rajdhani,sans-serif', fontWeight:600, color:STATUS_COLOR[f.status]||'#94a3b8', whiteSpace:'nowrap' }}>{f.status.replace(/_/g,' ')}</span></td>
                  <td><span style={{ fontSize:11, color:f.slaBreached?'#f87171':'var(--text-secondary)' }}>{fmtDate(f.slaDate)}{f.slaBreached&&' ⚠'}</span></td>
                  <td><span style={{ fontSize:11, color:'var(--text-secondary)' }}>{f._count?.evidence||0}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
