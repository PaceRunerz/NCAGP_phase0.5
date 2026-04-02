'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, Clock, CheckCircle2, TrendingUp,
  FileText, Upload, Activity, ChevronRight, RefreshCw,   call port 
  Server, BarChart3, Target, Zap,
} from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

function StatCard({ label, value, sub, color, icon, accent }: any) {
  return (
    <div className="stat-card anim-fade-up" style={{ '--accent-line': `linear-gradient(90deg,transparent,${accent}60,transparent)` } as any}>
      <div style={{ position:'absolute', top:18, right:18, color:accent+'30' }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function SLABar({ label, count, total, color }: any) {
  const pct = total > 0 ? Math.min((count/total)*100, 100) : 0;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:12, color:'rgba(148,163,184,0.7)' }}>{label}</span>
        <span style={{ fontSize:12, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color }}>{count}</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width 0.8s ease' }}/>
      </div>
    </div>
  );
}

export default function DeptDashboard() {
  const [user, setUser] = useState<any>(null);
  const isCISO = user?.role === 'DEPT_CISO';

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('ncagp_user')||'{}')); } catch {}
  }, []);

  const { data: findings, loading: fLoading, refresh } = useData<any>(
    useCallback(async () => {
      const res = await apiFetch(`/api/findings?limit=100`);
      return res;
    }, []),
    [],
    { refreshOnFocus: true, refreshOnVisible: true }
  );

  const allFindings = findings?.findings || [];

  // Compute stats from actual data
  const open       = allFindings.filter((f:any) => f.status === 'OPEN').length;
  const critical   = allFindings.filter((f:any) => f.severity === 'CRITICAL' && !['CLOSED','FALSE_POSITIVE'].includes(f.status)).length;
  const breached   = allFindings.filter((f:any) => f.slaBreached && !['CLOSED','FALSE_POSITIVE'].includes(f.status)).length;
  const inRem      = allFindings.filter((f:any) => f.status === 'IN_REMEDIATION').length;
  const closed     = allFindings.filter((f:any) => f.status === 'CLOSED').length;
  const total      = allFindings.length;
  const remediationRate = total > 0 ? Math.round((closed/total)*100) : 0;

  const recent = allFindings.slice(0,8);
  const urgentSLA = allFindings.filter((f:any) => f.slaBreached && f.status !== 'CLOSED').slice(0,5);

  const STATUS_COLOR: Record<string,string> = {
    OPEN:'#f87171', ACKNOWLEDGED:'#fbbf24', IN_REMEDIATION:'#60a5fa',
    REMEDIATED_PENDING_VALIDATION:'#34d399', VALIDATED:'#4ade80',
    CLOSED:'#475569', RISK_ACCEPTED:'#fb923c',
  };
  const SEV_COLOR: Record<string,string> = { CRITICAL:'#f87171', HIGH:'#fb923c', MEDIUM:'#fbbf24', LOW:'#94a3b8', INFO:'#60a5fa' };

  return (
    <div style={{ padding:24, position:'relative', zIndex:1 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }} className="anim-fade-up">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'rgba(26,86,219,0.15)', border:'1px solid rgba(26,86,219,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isCISO ? <Shield size={18} color="#60a5fa"/> : <Target size={18} color="#60a5fa"/>}
            </div>
            <div>
              <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:22, fontWeight:700 }}>
                {isCISO ? 'CISO Command Centre' : 'Security Operations'}
              </h1>
              <p style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                {user?.orgName || 'Department'} · {isCISO ? 'Executive Overview' : 'Security Officer View'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={refresh} className="btn btn-ghost" style={{ fontSize:11 }}>
            <RefreshCw size={11}/>Refresh
          </button>
          {isCISO && (
            <a href="/settings" className="btn btn-primary" style={{ fontSize:11, textDecoration:'none' }}>
              <BarChart3 size={11}/>Download Report
            </a>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }} className="stagger">
        <StatCard label="Open Findings"      value={open}              sub="Require action"            color="#f87171" accent="#ef4444" icon={<AlertTriangle size={32}/>}/>
        <StatCard label="Critical (P0)"      value={critical}          sub="Immediate action required" color="#f87171" accent="#ef4444" icon={<Zap size={32}/>}/>
        <StatCard label="SLA Breached"       value={breached}          sub="Past deadline"             color="#fb923c" accent="#f97316" icon={<Clock size={32}/>}/>
        <StatCard label="Remediation Rate"   value={`${remediationRate}%`} sub={`${closed}/${total} closed`} color="#34d399" accent="#10b981" icon={<CheckCircle2 size={32}/>}/>
      </div>

      {/* Two column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Severity breakdown */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <Activity size={14} color="#60a5fa"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Finding Breakdown</span>
          </div>
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
            const count = allFindings.filter((f:any) => f.severity===sev && !['CLOSED','FALSE_POSITIVE'].includes(f.status)).length;
            return <SLABar key={sev} label={sev} count={count} total={Math.max(open,1)} color={SEV_COLOR[sev]}/>;
          })}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12, marginTop:4 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, color:'rgba(148,163,184,0.4)' }}>In Remediation</span>
              <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'#60a5fa' }}>{inRem}</span>
            </div>
          </div>
        </div>

        {/* SLA breaches */}
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <Clock size={14} color="#f87171"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>SLA Breaches</span>
            {urgentSLA.length > 0 && <span style={{ marginLeft:'auto', fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, padding:'2px 7px', borderRadius:3, background:'rgba(239,68,68,0.15)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)' }}>URGENT</span>}
          </div>
          {fLoading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:36 }}/>)}</div>
          ) : urgentSLA.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'rgba(148,163,184,0.3)' }}>
              <CheckCircle2 size={28} style={{ margin:'0 auto 8px', display:'block', color:'#34d399', opacity:0.5 }}/>
              <div style={{ fontSize:12 }}>No SLA breaches — great work!</div>
            </div>
          ) : urgentSLA.map((f:any) => {
            const days = Math.floor((Date.now()-new Date(f.slaDate).getTime())/86400000);
            return (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:7, marginBottom:6, cursor:'pointer' }}
                onClick={()=>window.location.href='/findings'}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:SEV_COLOR[f.severity]||'#94a3b8', flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'rgba(148,163,184,0.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                  <div style={{ fontSize:10, color:'#f87171', fontFamily:'IBM Plex Mono,monospace' }}>{days}d overdue</div>
                </div>
                <ChevronRight size={12} style={{ color:'rgba(148,163,184,0.3)', flexShrink:0 }}/>
              </div>
            );
          })}
          {urgentSLA.length > 0 && (
            <a href="/findings?status=OPEN" style={{ display:'block', textAlign:'center', fontSize:11, color:'#60a5fa', textDecoration:'none', marginTop:8, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.05em' }}>
              View All Breaches →
            </a>
          )}
        </div>
      </div>

      {/* Recent findings table */}
      <div className="glass-card">
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={14} color="#fbbf24"/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Recent Findings</span>
          </div>
          <a href="/findings" className="btn btn-ghost" style={{ fontSize:10, padding:'5px 12px', textDecoration:'none' }}>View All →</a>
        </div>
        {fLoading ? (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>{[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{ height:44 }}/>)}</div>
        ) : (
          <table className="gov-table">
            <thead><tr>
              <th>Severity</th><th>Finding</th><th>Status</th><th>SLA</th><th>Evidence</th>
            </tr></thead>
            <tbody>
              {recent.length===0 ? (
                <tr><td colSpan={5} style={{ padding:'40px 0', textAlign:'center', color:'rgba(148,163,184,0.3)' }}>No findings yet</td></tr>
              ) : recent.map((f:any) => (
                <tr key={f.id} style={{ cursor:'pointer' }} onClick={()=>window.location.href='/findings'}>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:4, fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, background:SEV_COLOR[f.severity]+'15', color:SEV_COLOR[f.severity], border:`1px solid ${SEV_COLOR[f.severity]}30` }}>
                      {f.severity}
                    </span>
                  </td>
                  <td><div style={{ fontSize:12, color:'rgba(148,163,184,0.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:240 }}>{f.title}</div></td>
                  <td><span style={{ fontSize:11, fontFamily:'Rajdhani,sans-serif', fontWeight:600, color:STATUS_COLOR[f.status]||'#94a3b8' }}>{f.status.replace(/_/g,' ')}</span></td>
                  <td><span style={{ fontSize:11, color:f.slaBreached?'#f87171':'rgba(148,163,184,0.4)' }}>{f.slaDate?new Date(f.slaDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'—'}</span></td>
                  <td><span style={{ fontSize:11, color:'rgba(148,163,184,0.35)' }}>{f._count?.evidence||0}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick actions for security officer */}
      {!isCISO && (
        <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { label:'Upload Evidence',   href:'/evidence',  icon:<Upload size={18}/>,   color:'#60a5fa', desc:'Upload proof of remediation for open findings' },
            { label:'View Asset Register', href:'/assets',  icon:<Server size={18}/>,   color:'#fbbf24', desc:'Check asset inventory and criticality' },
            { label:'Audit Ledger',      href:'/ledger',    icon:<FileText size={18}/>, color:'#34d399', desc:'View immutable audit trail of all actions' },
          ].map(({ label, href, icon, color, desc }) => (
            <a key={href} href={href} style={{ display:'flex', flexDirection:'column', gap:10, padding:'16px 18px', background:'rgba(1,14,30,0.6)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, textDecoration:'none', transition:'all 0.15s', cursor:'pointer' }}
              onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=color+'40';(e.currentTarget as any).style.background='rgba(1,14,30,0.9)';}}
              onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='rgba(255,255,255,0.06)';(e.currentTarget as any).style.background='rgba(1,14,30,0.6)';}}>
              <div style={{ color }}>{icon}</div>
              <div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14, color:'rgba(148,163,184,0.9)', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', lineHeight:1.5 }}>{desc}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
