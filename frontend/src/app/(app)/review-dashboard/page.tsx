'use client';
import { useState, useEffect, useCallback } from 'react';
import { Eye, FileText, BarChart3, Clock, CheckCircle2, AlertTriangle, Shield, TrendingDown, RefreshCw, BookOpen } from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

export default function ReviewDashboard() {
  const [user, setUser] = useState<any>(null);
  const isObserver = user?.role === 'OBSERVER';

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('ncagp_user')||'{}')); } catch {}
  }, []);

  const { data: findings, loading, refresh } = useData<any>(
    useCallback(async () => apiFetch('/api/findings?limit=100'), []),
    [], { refreshOnFocus:true, refreshOnVisible:true }
  );

  const all      = findings?.findings || [];
  const open     = all.filter((f:any)=>f.status==='OPEN').length;
  const critical = all.filter((f:any)=>f.severity==='CRITICAL'&&f.status!=='CLOSED').length;
  const breached = all.filter((f:any)=>f.slaBreached&&f.status!=='CLOSED').length;
  const closed   = all.filter((f:any)=>f.status==='CLOSED').length;
  const total    = all.length;

  const bySeverity: Record<string,number> = {};
  const byOrg: Record<string,{name:string;count:number}> = {};
  all.forEach((f:any) => {
    bySeverity[f.severity] = (bySeverity[f.severity]||0)+1;
    if (f.org) {
      const key = f.org.shortCode;
      if (!byOrg[key]) byOrg[key] = { name:f.org.name, count:0 };
      byOrg[key].count++;
    }
  });

  const topOrgs = Object.values(byOrg).sort((a:any,b:any)=>b.count-a.count).slice(0,5);
  const SEV_COLOR: Record<string,string> = { CRITICAL:'#f87171', HIGH:'#fb923c', MEDIUM:'#fbbf24', LOW:'#94a3b8', INFO:'#60a5fa' };
  const recentClosed = all.filter((f:any)=>f.status==='CLOSED').slice(0,6);

  return (
    <div style={{ padding:24, position:'relative', zIndex:1 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }} className="anim-fade-up">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Eye size={18} color="#a78bfa"/>
          </div>
          <div>
            <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:22, fontWeight:700 }}>
              {isObserver ? 'Observer View' : 'Review Dashboard'}
            </h1>
            <p style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              {user?.name} · {isObserver ? 'Read-only access' : 'Reviewer access'} · Audit trail visible
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={refresh} className="btn btn-ghost" style={{ fontSize:11 }}><RefreshCw size={11}/>Refresh</button>
          {!isObserver && (
            <a href="/settings" className="btn btn-primary" style={{ textDecoration:'none', fontSize:11 }}><BarChart3 size={11}/>Export Report</a>
          )}
        </div>
      </div>

      {/* Read-only notice */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:8, marginBottom:20, fontSize:12, color:'rgba(167,139,250,0.8)' }}>
        <Eye size={13}/>
        <span>You have <strong>{isObserver ? 'read-only observer' : 'reviewer'}</strong> access. You can view all findings and {!isObserver && 'leave comments but '} cannot modify data.</span>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }} className="stagger">
        {[
          { label:'Total Findings',    value:total,    sub:'across all orgs',          color:'rgba(148,163,184,0.8)', accent:'#64748b' },
          { label:'Critical Open',     value:critical, sub:'require immediate action',  color:'#f87171', accent:'#ef4444' },
          { label:'SLA Breaches',      value:breached, sub:'past remediation deadline', color:'#fb923c', accent:'#f97316' },
          { label:'Fully Closed',      value:closed,   sub:'successfully remediated',   color:'#34d399', accent:'#10b981' },
        ].map(({ label, value, sub, color, accent }) => (
          <div key={label} className="stat-card anim-fade-up" style={{ '--accent-line':`linear-gradient(90deg,transparent,${accent}60,transparent)` } as any}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Severity breakdown */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <BarChart3 size={14} color="#a78bfa"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Finding Distribution</span>
          </div>
          {['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(sev => {
            const count = bySeverity[sev]||0;
            const pct = total > 0 ? Math.round((count/total)*100) : 0;
            return (
              <div key={sev} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:SEV_COLOR[sev], width:60, flexShrink:0 }}>{sev}</span>
                <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:SEV_COLOR[sev], borderRadius:3, transition:'width 0.8s ease' }}/>
                </div>
                <span style={{ fontSize:11, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:'rgba(148,163,184,0.6)', width:30, textAlign:'right', flexShrink:0 }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Top departments */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <TrendingDown size={14} color="#fbbf24"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Top Departments by Findings</span>
          </div>
          {topOrgs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'rgba(148,163,184,0.3)', fontSize:12 }}>No data yet</div>
          ) : topOrgs.map(({ name, count }:any, i) => (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:'rgba(148,163,184,0.35)', width:16, flexShrink:0 }}>#{i+1}</span>
              <span style={{ fontSize:12, color:'rgba(148,163,184,0.7)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
              <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:16, color:'rgba(148,163,184,0.8)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recently closed */}
      <div className="glass-card">
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle2 size={14} color="#34d399"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Recently Closed Findings</span>
          </div>
          <a href="/findings?status=CLOSED" className="btn btn-ghost" style={{ fontSize:10, padding:'5px 12px', textDecoration:'none' }}>View All →</a>
        </div>
        {loading ? (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>{[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:44 }}/>)}</div>
        ) : recentClosed.length === 0 ? (
          <div style={{ padding:'40px 0', textAlign:'center', color:'rgba(148,163,184,0.3)', fontSize:12 }}>No closed findings yet</div>
        ) : (
          <table className="gov-table">
            <thead><tr><th>Severity</th><th>Finding</th><th>Organisation</th><th>Closed</th></tr></thead>
            <tbody>
              {recentClosed.map((f:any) => (
                <tr key={f.id}>
                  <td><span style={{ display:'inline-flex', padding:'2px 7px', borderRadius:4, fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, background:`${SEV_COLOR[f.severity]}15`, color:SEV_COLOR[f.severity], border:`1px solid ${SEV_COLOR[f.severity]}30` }}>{f.severity}</span></td>
                  <td><div style={{ fontSize:12, color:'rgba(148,163,184,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }}>{f.title}</div></td>
                  <td><span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'rgba(148,163,184,0.35)' }}>{f.org?.shortCode}</span></td>
                  <td><span style={{ fontSize:11, color:'#34d399' }}>{f.closedAt ? new Date(f.closedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ledger link for reviewer */}
      {!isObserver && (
        <div style={{ marginTop:16 }}>
          <a href="/ledger" style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', background:'rgba(1,14,30,0.5)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, textDecoration:'none', transition:'all 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='rgba(96,165,250,0.3)';}}
            onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='rgba(255,255,255,0.06)';}}>
            <div style={{ width:36, height:36, borderRadius:9, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BookOpen size={16} color="#60a5fa"/>
            </div>
            <div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'rgba(148,163,184,0.9)', marginBottom:2 }}>Immutable Audit Ledger</div>
              <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)' }}>View the complete tamper-evident hash-chained log of all actions in the system</div>
            </div>
            <div style={{ marginLeft:'auto', color:'rgba(148,163,184,0.3)' }}><CheckCircle2 size={16}/></div>
          </a>
        </div>
      )}
    </div>
  );
}
