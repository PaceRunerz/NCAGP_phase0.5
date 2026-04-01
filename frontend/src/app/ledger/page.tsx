'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ShieldCheck, CheckCircle2, AlertTriangle, Search, RefreshCw, Filter, Clock } from 'lucide-react';

const EVENT_COLORS: Record<string,{color:string;bg:string;border:string}> = {
  FINDING_CREATED:       {color:'#2563eb',bg:'#eff6ff',border:'#bfdbfe'},
  FINDING_STATUS_CHANGED:{color:'#d97706',bg:'#fffbeb',border:'#fde68a'},
  EVIDENCE_UPLOADED:     {color:'#059669',bg:'#f0fdf4',border:'#bbf7d0'},
  EVIDENCE_SUPERSEDED:   {color:'#ea580c',bg:'#fff7ed',border:'#fed7aa'},
  EVIDENCE_INTEGRITY_CHECK:{color:'#dc2626',bg:'#fef2f2',border:'#fecaca'},
  USER_LOGIN:            {color:'#64748b',bg:'#f8fafc',border:'#e2e8f0'},
  USER_LOGOUT:           {color:'#94a3b8',bg:'#f8fafc',border:'#f1f5f9'},
  USER_LOCKED:           {color:'#dc2626',bg:'#fef2f2',border:'#fecaca'},
  AUDIT_CREATED:         {color:'#0891b2',bg:'#ecfeff',border:'#a5f3fc'},
  ORG_CREATED:           {color:'#7c3aed',bg:'#ede9fe',border:'#ddd6fe'},
  VENDOR_BLACKLISTED:    {color:'#dc2626',bg:'#fef2f2',border:'#fecaca'},
};

export default function LedgerPage() {
  const router = useRouter();
  const [entries,      setEntries]     = useState<any[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [searchId,     setSearchId]    = useState('');
  const [entityType,   setEntityType]  = useState('Finding');
  const [chainResult,  setChainResult] = useState<any>(null);
  const [chainLoading, setChainLoading]= useState(false);
  const [filterType,   setFilterType]  = useState('');

  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) { router.replace('/login'); return; }
    loadRecent();
  }, []);

  const token = () => localStorage.getItem('ncagp_token') || '';

  // Load recent entries by fetching all known entity types
  const loadRecent = async () => {
    setLoading(true);
    try {
      // Fetch recent USER_LOGIN entries which always exist
      const res = await fetch(`/api/ledger?entityType=User&entityId=${JSON.parse(localStorage.getItem('ncagp_user')||'{}').id||''}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch { setEntries([]); }
    setLoading(false);
  };

  const search = async () => {
    if (!searchId.trim()) { loadRecent(); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger?entityType=${entityType}&entityId=${encodeURIComponent(searchId.trim())}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      setEntries(Array.isArray(d) ? d : []);
    } catch { setEntries([]); }
    setLoading(false);
  };

  const verifyChain = async () => {
    setChainLoading(true);
    try {
      const res = await fetch('/api/ledger/verify-chain', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body:'{}',
      });
      setChainResult(await res.json());
    } catch {}
    setChainLoading(false);
  };

  const fmt = (d:string) => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});

  const filtered = filterType ? entries.filter(e=>e.eventType===filterType) : entries;
  const eventTypes = [...new Set(entries.map(e=>e.eventType))];

  return (
    <div style={{display:'flex',minHeight:'100vh',position:'relative',zIndex:1}}>
      <main style={{flex:1,overflow:'auto',padding:24}}>

        {/* Header */}
        <div className="page-header">
          <div style={{width:36,height:36,borderRadius:9,background:'#eff6ff',border:'1px solid #bfdbfe',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <BookOpen size={17} color="#2563eb"/>
          </div>
          <h1>Immutable Audit Ledger</h1>
        </div>
        <p className="page-subtitle">Tamper-evident SHA-256 hash-chained event log · Every action recorded permanently</p>

        {/* Chain verification card */}
        <div className="card card-accent" style={{padding:'16px 20px',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14,color:'#0f172a',marginBottom:2}}>Chain Integrity Verification</div>
              <div style={{fontSize:11,color:'#64748b'}}>Recomputes all SHA-256 hashes and verifies the chain is unbroken since genesis block</div>
            </div>
            <button onClick={verifyChain} disabled={chainLoading} className="btn btn-primary" style={{flexShrink:0}}>
              <ShieldCheck size={13}/>{chainLoading?'Verifying...':'Verify Chain'}
            </button>
          </div>
          {chainResult && (
            <div style={{marginTop:12,display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:chainResult.isValid?'#f0fdf4':'#fef2f2',border:`1px solid ${chainResult.isValid?'#bbf7d0':'#fecaca'}`,borderRadius:8}}>
              {chainResult.isValid
                ? <><CheckCircle2 size={14} color="#059669"/><span style={{fontSize:12,color:'#059669',fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>CHAIN INTACT — {chainResult.totalEntries} entries verified · No tampering detected</span></>
                : <><AlertTriangle size={14} color="#dc2626"/><span style={{fontSize:12,color:'#dc2626',fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>INTEGRITY VIOLATION at {chainResult.brokenAt} · Entry: {chainResult.brokenEntryId}</span></>
              }
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="card" style={{padding:'14px 16px',marginBottom:16}}>
          <div style={{fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#94a3b8',marginBottom:10}}>
            Search Audit Trail — paste any entity ID or leave blank for your recent activity
          </div>
          <div style={{display:'flex',gap:8}}>
            <select value={entityType} onChange={e=>setEntityType(e.target.value)}
              style={{padding:'8px 12px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:8,color:'#334155',fontSize:12,fontFamily:'IBM Plex Sans,sans-serif',outline:'none',flexShrink:0}}>
              {['Finding','Evidence','Audit','User','Organization','Asset'].map(t=><option key={t}>{t}</option>)}
            </select>
            <input value={searchId} onChange={e=>setSearchId(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}
              placeholder="UUID (optional) — leave blank to see your recent activity"
              className="gov-input" style={{flex:1,fontFamily:'IBM Plex Mono,monospace',fontSize:12}}
            />
            <button onClick={search} className="btn btn-primary" style={{flexShrink:0}}>
              <Search size={12}/>Search
            </button>
            <button onClick={()=>{setSearchId('');loadRecent();}} className="btn btn-ghost" style={{flexShrink:0}}>
              <RefreshCw size={12}/>
            </button>
          </div>

          {/* Event type filter */}
          {eventTypes.length > 0 && (
            <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
              <button onClick={()=>setFilterType('')}
                style={{padding:'3px 10px',borderRadius:5,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.05em',cursor:'pointer',
                  background:filterType===''?'#eff6ff':'#f8fafc',border:`1px solid ${filterType===''?'#bfdbfe':'#e2e8f0'}`,color:filterType===''?'#2563eb':'#94a3b8'}}>
                All ({entries.length})
              </button>
              {eventTypes.map(et=>(
                <button key={et} onClick={()=>setFilterType(et===filterType?'':et)}
                  style={{padding:'3px 10px',borderRadius:5,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.04em',cursor:'pointer',
                    background:filterType===et?(EVENT_COLORS[et]?.bg||'#f8fafc'):'#f8fafc',
                    border:`1px solid ${filterType===et?(EVENT_COLORS[et]?.border||'#e2e8f0'):'#e2e8f0'}`,
                    color:filterType===et?(EVENT_COLORS[et]?.color||'#64748b'):'#94a3b8'}}>
                  {et.replace(/_/g,' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:80,animationDelay:`${i*80}ms`}}/>)}
          </div>
        ) : filtered.length===0 ? (
          <div className="card" style={{padding:'60px',textAlign:'center'}}>
            <BookOpen size={36} style={{margin:'0 auto 14px',display:'block',color:'#e2e8f0'}}/>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:17,color:'#94a3b8',marginBottom:4}}>No ledger entries found</div>
            <div style={{fontSize:12,color:'#cbd5e1'}}>Try a different entity type or ID</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map((entry,i)=>{
              const ec = EVENT_COLORS[entry.eventType]||{color:'#64748b',bg:'#f8fafc',border:'#e2e8f0'};
              return (
                <div key={entry.id} className="card" style={{padding:'14px 16px',borderLeft:`3px solid ${ec.color}`,animation:`fadeUp 0.25s ease ${i*30}ms both`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.06em',background:ec.bg,color:ec.color,border:`1px solid ${ec.border}`}}>
                        {entry.eventType?.replace(/_/g,' ')}
                      </span>
                      {i===0 && <span style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',padding:'1px 6px',borderRadius:3,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe'}}>LATEST</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#94a3b8',fontFamily:'IBM Plex Mono,monospace',flexShrink:0}}>
                      <Clock size={9}/>{fmt(entry.timestamp)}
                    </div>
                  </div>

                  {entry.user && (
                    <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>
                      By <span style={{fontWeight:600,color:'#334155'}}>{entry.user.name}</span>
                      {' · '}<span style={{color:'#94a3b8'}}>{entry.user.role}</span>
                      {' · '}<span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'#94a3b8'}}>{entry.ipAddress}</span>
                    </div>
                  )}

                  {/* Entity info */}
                  <div style={{fontSize:10,color:'#94a3b8',fontFamily:'IBM Plex Mono,monospace',marginBottom:6}}>
                    Entity: <span style={{color:'#64748b'}}>{entry.entityType}</span>
                    {' · '}<span style={{color:'#64748b'}}>{entry.entityId?.slice(0,20)}…</span>
                  </div>

                  {/* Hash chain */}
                  <div style={{display:'flex',gap:16,fontSize:9.5,fontFamily:'IBM Plex Mono,monospace',color:'#cbd5e1',marginTop:8,paddingTop:8,borderTop:'1px solid #f1f5f9'}}>
                    <span>prev: <span style={{color:'#94a3b8'}}>{entry.hashPrev?.slice(0,20)}…</span></span>
                    <span>curr: <span style={{color:'#2563eb'}}>{entry.hashCurrent?.slice(0,20)}…</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
