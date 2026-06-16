'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, ChevronRight, Filter, FileText, X, Shield } from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

interface Finding {
  id:string; title:string; severity:string; status:string;
  slaDate:string; slaBreached:boolean; isRecurring:boolean; createdAt:string;
  org:{ name:string; shortCode:string };
  asset?:{ name:string; criticality:number };
  _count:{ evidence:number; tasks:number };    d
}

const SEV: Record<string,any> = {
  CRITICAL:{ label:'P0', color:'#f87171', bg:'rgba(239,68,68,0.12)', border:'rgba(239,68,68,0.3)' },
  HIGH:    { label:'P1', color:'#fb923c', bg:'rgba(249,115,22,0.12)', border:'rgba(249,115,22,0.3)' },
  MEDIUM:  { label:'P2', color:'#fbbf24', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)' },
  LOW:     { label:'P3', color:'#94a3b8', bg:'rgba(148,163,184,0.08)', border:'rgba(148,163,184,0.2)' },
  INFO:    { label:'I',  color:'#60a5fa', bg:'rgba(59,130,246,0.08)',  border:'rgba(59,130,246,0.2)' },
};
const STATUS_COLOR: Record<string,string> = {
  OPEN:'#f87171', ACKNOWLEDGED:'#fbbf24', IN_REMEDIATION:'#60a5fa',
  REMEDIATED_PENDING_VALIDATION:'#34d399', VALIDATED:'#4ade80',
  CLOSED:'#475569', RISK_ACCEPTED:'#fb923c', FALSE_POSITIVE:'#374151',
};

function SevBadge({ severity }: { severity:string }) {
  const s = SEV[severity]||SEV.INFO;
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', borderRadius:4, background:s.bg, border:`1px solid ${s.border}`, color:s.color, fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{s.label} · {severity}</span>;
}

export default function FindingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [severity,  setSeverity]  = useState('');
  const [status,    setStatus]    = useState('');
  const [selected,  setSelected]  = useState<Finding|null>(null);
  const orgId = searchParams.get('orgId') || '';

  // useData auto-refreshes on tab focus / visibility change
  const { data, loading, refresh } = useData<{ findings: Finding[]; total: number }>(
    useCallback(async () => {
      const params = new URLSearchParams();
      if (orgId)    params.set('orgId', orgId);
      if (severity) params.set('severity', severity);
      if (status)   params.set('status', status);
      return apiFetch(`/api/findings?${params}`);
    }, [orgId, severity, status]),
    [orgId, severity, status],
    { refreshOnFocus: true, refreshOnVisible: true }
  );

  const findings = data?.findings || [];
  const total    = data?.total    || 0;
  const fmt = (d:string) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

  return (
    <div style={{ padding:24, position:'relative', zIndex:1 }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ width:36, height:36, borderRadius:9, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <AlertTriangle size={17} color="#fbbf24"/>
        </div>
        <h1>Findings Registry</h1>
      </div>
      <p className="page-subtitle">{total} total · {orgId?'Filtered by org':'All organisations'}</p>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <Filter size={11} style={{ color:'rgba(148,163,184,0.3)', flexShrink:0 }}/>
        <select value={severity} onChange={e=>setSeverity(e.target.value)} className="gov-input" style={{ width:'auto', padding:'7px 10px', fontSize:12 }}>
          <option value="">All Severities</option>
          {['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="gov-input" style={{ width:'auto', padding:'7px 10px', fontSize:12 }}>
          <option value="">All Statuses</option>
          {['OPEN','ACKNOWLEDGED','IN_REMEDIATION','REMEDIATED_PENDING_VALIDATION','VALIDATED','CLOSED','RISK_ACCEPTED','FALSE_POSITIVE'].map(s=>
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          )}
        </select>
        {(severity||status) && (
          <button onClick={()=>{setSeverity('');setStatus('');}} className="btn btn-ghost" style={{ padding:'7px 12px', fontSize:11 }}>
            <X size={10}/>Clear
          </button>
        )}
        <button onClick={refresh} className="btn btn-ghost" style={{ marginLeft:'auto', padding:'7px 12px', fontSize:11 }}>
          <RefreshCw size={11}/>Refresh
        </button>
      </div>

      {/* Table */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
            {[...Array(6)].map((_,i)=><div key={i} className="skeleton" style={{ height:48, animationDelay:`${i*60}ms` }}/>)}
          </div>
        ) : (
          <table className="gov-table">
            <thead>
              <tr>
                {['Severity','Finding','Status','Org','SLA Deadline','Evidence'].map(h=><th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {findings.length===0 ? (
                <tr><td colSpan={6} style={{ padding:'60px 0', textAlign:'center', color:'rgba(148,163,184,0.3)' }}>
                  <Shield size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.1 }}/>
                  No findings found
                </td></tr>
              ) : findings.map(f=>(
                <tr key={f.id} onClick={()=>setSelected(f)} style={{ cursor:'pointer' }}>
                  <td><SevBadge severity={f.severity}/></td>
                  <td>
                    <div style={{ fontWeight:500, color:'var(--text-primary)', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280 }}>{f.title}</div>
                    {f.isRecurring && <span style={{ fontSize:10, color:'#fb923c', fontFamily:'IBM Plex Mono,monospace' }}>↻ recurring</span>}
                    {f.asset && <div style={{ fontSize:10, color:'var(--text-ghost)', marginTop:1 }}>Asset: {f.asset.name}</div>}
                  </td>
                  <td><span style={{ fontSize:11, fontFamily:'Rajdhani,sans-serif', fontWeight:600, letterSpacing:'0.05em', color:STATUS_COLOR[f.status]||'#94a3b8' }}>{f.status.replace(/_/g,' ')}</span></td>
                  <td><span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'rgba(148,163,184,0.5)' }}>{f.org?.shortCode}</span></td>
                  <td>
                    {f.slaDate ? (
                      <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:f.slaBreached?'#f87171':'rgba(148,163,184,0.4)' }}>
                        {f.slaBreached&&<Clock size={10}/>}
                        {fmt(f.slaDate)}
                        {f.slaBreached&&<span style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:'#f87171', letterSpacing:'0.08em' }}>BREACHED</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span style={{ fontSize:11, color:'rgba(148,163,184,0.4)' }}>{f._count.evidence} <span style={{ color:'rgba(148,163,184,0.2)' }}>files</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <>
          <div className="drawer-backdrop" onClick={()=>setSelected(null)}/>
          <div className="drawer">
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${SEV[selected.severity]?.color||'#1a56db'}50,transparent)` }}/>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
              <SevBadge severity={selected.severity}/>
              <button onClick={()=>setSelected(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'rgba(148,163,184,0.5)', width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>×</button>
            </div>
            <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:18, fontWeight:700, marginBottom:4, lineHeight:1.3 }}>{selected.title}</h2>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'rgba(148,163,184,0.25)', marginBottom:20, letterSpacing:'0.06em' }}>{selected.id}</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              {[
                { label:'Status',      value:selected.status.replace(/_/g,' '), color:STATUS_COLOR[selected.status] },
                { label:'Organisation', value:selected.org?.shortCode,           color:'var(--text-primary)' },
                { label:'SLA Deadline', value:fmt(selected.slaDate),             color:selected.slaBreached?'#f87171':'#94a3b8' },
                { label:'Evidence',    value:`${selected._count.evidence} files`, color:'#60a5fa' },
              ].map(({label,value,color})=>(
                <div key={label} style={{ background:'rgba(2,13,26,0.4)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:6, padding:'10px 12px' }}>
                  <div style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.35)', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:500, color }}>{value||'—'}</div>
                </div>
              ))}
            </div>

            {selected.slaBreached && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(127,29,29,0.2)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, marginBottom:16 }}>
                <Clock size={13} color="#f87171"/>
                <span style={{ fontSize:12, color:'#f87171', fontFamily:'Rajdhani,sans-serif', fontWeight:600 }}>SLA DEADLINE BREACHED — IMMEDIATE ACTION REQUIRED</span>
              </div>
            )}

            <a href={`/findings/${selected.id}/evidence`} className="btn btn-primary" style={{ display:'flex', justifyContent:'center', textDecoration:'none' }}>
              <FileText size={13}/>Upload Evidence <ChevronRight size={12}/>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
