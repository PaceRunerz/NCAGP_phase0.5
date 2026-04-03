'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FileText, Upload, CheckCircle2, AlertTriangle,
  RefreshCw, Shield, Eye, Hash, Calendar,
  Download, Search, X, FileCheck, User, Lock,
} from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

const EV_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  SCREENSHOT:    { color:'#60a5fa', bg:'rgba(59,130,246,0.1)',   border:'rgba(59,130,246,0.25)'   },
  LOG_FILE:      { color:'#a78bfa', bg:'rgba(167,139,250,0.1)',  border:'rgba(167,139,250,0.25)'  },
  REPORT:        { color:'#34d399', bg:'rgba(52,211,153,0.1)',   border:'rgba(52,211,153,0.25)'   },
  CONFIGURATION: { color:'#fbbf24', bg:'rgba(245,158,11,0.1)',   border:'rgba(245,158,11,0.25)'   },
  VIDEO:         { color:'#fb923c', bg:'rgba(249,115,22,0.1)',   border:'rgba(249,115,22,0.25)'   },
  OTHER:         { color:'#94a3b8', bg:'rgba(148,163,184,0.08)', border:'rgba(148,163,184,0.18)'  },
};
const SEV_CLR: Record<string, string> = {
  CRITICAL:'#f87171', HIGH:'#fb923c', MEDIUM:'#fbbf24', LOW:'#94a3b8', INFO:'#60a5fa'
};

function fmtDT(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Kolkata',
  }) + ' IST';
}

// ── Upload Modal ─────────────────────────────────────────────────────
// FIXED: uses position:fixed + high z-index so footer never covers it
function UploadModal({ findingId, findingTitle, onClose, onSuccess }: {
  findingId: string; findingTitle: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [file,          setFile]         = useState<File | null>(null);
  const [evType,        setEvType]       = useState('SCREENSHOT');
  const [desc,          setDesc]         = useState('');
  const [hash,          setHash]         = useState('');
  const [uploading,     setUploading]    = useState(false);
  const [hashing,       setHashing]      = useState(false);
  const [error,         setError]        = useState('');
  const [success,       setSuccess]      = useState(false);

  const handleFile = async (f: File) => {
    setFile(f); setHashing(true);
    const buf = await f.arrayBuffer();
    const d   = await crypto.subtle.digest('SHA-256', buf);
    setHash(Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2,'0')).join(''));
    setHashing(false);
  };

  const submit = async () => {
    if (!file || !desc.trim()) return;
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('evidenceType', evType);
      fd.append('description', desc);
      fd.append('clientHash', hash);
      const res = await fetch(`/api/findings/${findingId}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1400);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Backdrop — z:1000 */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,4,12,0.85)',
          backdropFilter:'blur(8px)', zIndex:1000 }}
      />

      {/* Modal — z:1001, centered, max-height with scroll */}
      <div style={{
        position:'fixed',
        top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        width: 'min(480px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background:'linear-gradient(160deg,rgba(3,16,36,0.98),rgba(1,10,24,0.99))',
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:16,
        padding:24,
        zIndex:1001,
        boxShadow:'0 40px 100px rgba(0,0,0,0.8)',
      }} className="anim-pop-in">

        {/* Top shimmer */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
          background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.6),transparent)' }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:17, color:'#f0f4ff' }}>Upload Evidence</div>
            <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', marginTop:3, maxWidth:360,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{findingTitle}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, color:'rgba(148,163,184,0.5)', width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <X size={13}/>
          </button>
        </div>

        {success ? (
          <div style={{ textAlign:'center', padding:'32px 0' }} className="anim-pop-in">
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <CheckCircle2 size={24} color="#34d399"/>
            </div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:18, color:'#34d399', marginBottom:4 }}>Evidence Uploaded!</div>
            <div style={{ fontSize:12, color:'rgba(148,163,184,0.45)' }}>Now visible in the Evidence Portal</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Type */}
            <div>
              <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:7 }}>Evidence Type</div>
              <select value={evType} onChange={e => setEvType(e.target.value)} className="gov-input" style={{ fontSize:13 }}>
                {['SCREENSHOT','LOG_FILE','REPORT','CONFIGURATION','VIDEO','OTHER'].map(t =>
                  <option key={t} value={t}>{t.replace('_',' ')}</option>
                )}
              </select>
            </div>

            {/* File drop zone */}
            <div>
              <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:7 }}>File *</div>
              <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'22px 16px',
                background:file?'rgba(52,211,153,0.05)':'rgba(1,10,22,0.5)',
                border:`2px dashed ${file?'rgba(52,211,153,0.45)':'rgba(255,255,255,0.1)'}`,
                borderRadius:10, cursor:'pointer', transition:'all 0.15s', gap:8 }}>
                <input type="file" style={{ display:'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}/>
                {file ? (
                  <>
                    <FileCheck size={22} color="#34d399"/>
                    <div style={{ fontSize:13, color:'#34d399', fontWeight:500, textAlign:'center', wordBreak:'break-all' }}>{file.name}</div>
                    <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)' }}>{(file.size/1024/1024).toFixed(2)} MB</div>
                  </>
                ) : (
                  <>
                    <Upload size={22} color="rgba(148,163,184,0.3)"/>
                    <div style={{ fontSize:13, color:'rgba(148,163,184,0.45)' }}>Click to select file</div>
                    <div style={{ fontSize:11, color:'rgba(148,163,184,0.28)' }}>PNG, JPG, PDF, LOG, ZIP — max 50 MB</div>
                  </>
                )}
              </label>
            </div>

            {/* Hash */}
            {hashing && (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'rgba(148,163,184,0.45)' }}>
                <div style={{ width:12, height:12, border:'2px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                Computing SHA-256 hash...
              </div>
            )}
            {hash && !hashing && (
              <div style={{ padding:'10px 12px', background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:8 }}>
                <div style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', color:'rgba(59,130,246,0.55)', marginBottom:4 }}>SHA-256 HASH (computed in browser)</div>
                <div style={{ fontSize:10, fontFamily:'IBM Plex Mono,monospace', color:'#60a5fa', wordBreak:'break-all' }}>{hash}</div>
              </div>
            )}

            {/* Description */}
            <div>
              <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:7 }}>What does this prove? *</div>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                placeholder="Describe what this file demonstrates..."
                style={{ width:'100%', padding:'9px 12px', background:'rgba(1,10,22,0.7)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#f0f4ff', fontSize:12.5, fontFamily:'IBM Plex Sans,sans-serif', outline:'none', resize:'vertical', lineHeight:1.6, transition:'border-color 0.15s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, color:'#f87171', fontSize:12 }}>
                <AlertTriangle size={13}/>{error}
              </div>
            )}

            {/* Immutability notice */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, fontSize:11, color:'rgba(245,158,11,0.6)', lineHeight:1.5 }}>
              <Lock size={11} style={{ flexShrink:0, marginTop:1 }}/>
              Evidence is <strong>permanently immutable</strong> once uploaded. It cannot be deleted — only superseded.
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
              <button onClick={submit}
                disabled={!file || !desc.trim() || uploading || hashing}
                className="btn btn-primary"
                style={{ flex:2, justifyContent:'center', opacity:(!file||!desc.trim())?0.45:1 }}>
                {uploading
                  ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>Uploading...</>
                  : <><Shield size={12}/>Upload Evidence Securely</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ── Evidence detail drawer ────────────────────────────────────────
function EvidenceDrawer({ item, onClose }: { item: any; onClose: () => void }) {
  const [verifying, setVerifying]   = useState(false);
  const [result,    setResult]      = useState<any>(null);

  const verify = async () => {
    setVerifying(true);
    try { setResult(await apiFetch(`/api/evidence/${item.id}/verify`)); }
    catch { setResult({ isValid:false }); }
    setVerifying(false);
  };

  const ec = EV_COLORS[item.evidenceType] || EV_COLORS.OTHER;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="drawer">
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${ec.color}50,transparent)` }}/>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <span style={{ padding:'3px 9px', borderRadius:4, fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.07em', background:ec.bg, color:ec.color, border:`1px solid ${ec.border}` }}>
              {item.evidenceType?.replace('_',' ')}
            </span>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:16, fontWeight:700, color:'#f0f4ff', marginTop:8, wordBreak:'break-all' }}>{item.originalFilename}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'rgba(148,163,184,0.5)', width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { label:'Uploaded By', value: item.uploadedBy?.name || 'Unknown' },
            { label:'Role',        value: item.uploadedBy?.role || '—'       },
            { label:'Date & Time', value: fmtDT(item.createdAt)              },
            { label:'Size',        value: item.fileSize ? `${(item.fileSize/1024/1024).toFixed(2)} MB` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:'rgba(2,13,26,0.5)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:7, padding:'10px 12px' }}>
              <div style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.3)', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12, color:'rgba(148,163,184,0.8)', wordBreak:'break-all' }}>{value}</div>
            </div>
          ))}
        </div>

        {item.description && (
          <div style={{ padding:'11px 13px', background:'rgba(1,10,22,0.4)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:8, marginBottom:12 }}>
            <div style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.3)', marginBottom:5 }}>What This Proves</div>
            <div style={{ fontSize:12, color:'rgba(148,163,184,0.7)', lineHeight:1.6 }}>{item.description}</div>
          </div>
        )}

        <div style={{ padding:'11px 13px', background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:8, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
            <Hash size={11} color="#60a5fa"/>
            <span style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', color:'rgba(59,130,246,0.55)' }}>SHA-256 INTEGRITY HASH</span>
          </div>
          <div style={{ fontSize:10, fontFamily:'IBM Plex Mono,monospace', color:'#60a5fa', wordBreak:'break-all', lineHeight:1.6 }}>{item.fileHash}</div>
        </div>

        {result && (
          <div style={{ padding:'11px 13px', background:result.isValid?'rgba(52,211,153,0.06)':'rgba(239,68,68,0.08)', border:`1px solid ${result.isValid?'rgba(52,211,153,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:8, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:result.isValid?'#34d399':'#f87171', fontFamily:'Rajdhani,sans-serif', fontWeight:700 }}>
              {result.isValid ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
              {result.isValid ? 'HASH VERIFIED — File intact, no tampering detected' : 'HASH MISMATCH — File may have been tampered with'}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={verify} disabled={verifying} className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>
            {verifying
              ? <><div style={{ width:11, height:11, border:'1.5px solid rgba(148,163,184,0.3)', borderTopColor:'#94a3b8', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>Verifying...</>
              : <><Hash size={11}/>Verify Integrity</>
            }
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
}

// ── Main Evidence Portal ──────────────────────────────────────────
export default function EvidencePage() {
  const [search,    setSearch]    = useState('');
  const [filterType,setFilterType]= useState('');
  const [modal,     setModal]     = useState<{ findingId:string; title:string }|null>(null);
  const [selected,  setSelected]  = useState<any>(null);
  const [user]                    = useState<any>(() => { try { return JSON.parse(localStorage.getItem('ncagp_user')||'{}'); } catch { return {}; } });

  const canUpload = ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN'].includes(user?.role);

  // Load findings
  const { data: findingsData, loading: fl, refresh: refreshFindings } = useData<any>(
    useCallback(() => apiFetch('/api/findings?limit=200'), []),
    [], { refreshOnFocus:true, refreshOnVisible:true }
  );

  // Load all evidence
  const { data: allEvidence, loading: el, refresh: refreshEvidence } = useData<any[]>(
    useCallback(async () => {
      const res = await apiFetch('/api/findings?limit=200');
      const findings = (res?.findings || []).filter((f:any) => f._count?.evidence > 0);
      const chunks   = await Promise.all(findings.slice(0,60).map(async (f:any) => {
        try {
          const ev = await apiFetch(`/api/findings/${f.id}/evidence`);
          return (Array.isArray(ev) ? ev : ev?.evidence || []).map((e:any) => ({
            ...e,
            findingTitle:    f.title,
            findingSeverity: f.severity,
            orgShortCode:    f.org?.shortCode,
          }));
        } catch { return []; }
      }));
      return chunks.flat();
    }, []),
    [], { refreshOnFocus:true, refreshOnVisible:true }
  );

  const findings  = findingsData?.findings || [];
  const evidence  = allEvidence || [];
  const openFindings = findings.filter((f:any) => !['CLOSED','FALSE_POSITIVE'].includes(f.status));

  const filtered = evidence.filter((e:any) => {
    const ms = !search || e.originalFilename?.toLowerCase().includes(search.toLowerCase()) || e.findingTitle?.toLowerCase().includes(search.toLowerCase());
    const mt = !filterType || e.evidenceType === filterType;
    return ms && mt;
  });

  const handleSuccess = () => { refreshFindings(); refreshEvidence(); };

  return (
    <div style={{ padding:24, position:'relative', zIndex:1 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }} className="anim-fade-up">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={17} color="#34d399"/>
            </div>
            <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:22, fontWeight:700 }}>Evidence Portal</h1>
          </div>
          <p style={{ fontSize:11, color:'rgba(148,163,184,0.4)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            Immutable court-grade evidence store · SHA-256 verified · {evidence.length} files
          </p>
        </div>
        <button onClick={() => { refreshFindings(); refreshEvidence(); }} className="btn btn-ghost" style={{ fontSize:11 }}>
          <RefreshCw size={11}/>Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }} className="stagger">
        {[
          { label:'Total Files',       value:evidence.length,                                          color:'#60a5fa' },
          { label:'Findings Covered',  value:findings.filter((f:any)=>f._count?.evidence>0).length,   color:'#34d399' },
          { label:'No Evidence Yet',   value:openFindings.filter((f:any)=>f._count?.evidence===0).length, color:'#fbbf24' },
          { label:'Evidence Types',    value:new Set(evidence.map((e:any)=>e.evidenceType)).size,      color:'#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card anim-fade-up">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Upload selector */}
      {canUpload && (
        <div className="glass-card" style={{ padding:'16px 20px', marginBottom:16 }}>
          <div style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:10 }}>
            Upload Evidence for a Finding
          </div>
          <select className="gov-input" style={{ fontSize:12 }} defaultValue=""
            onChange={e => {
              const f = findings.find((fi:any) => fi.id === e.target.value);
              if (f) setModal({ findingId:f.id, title:f.title });
              e.target.value = '';
            }}>
            <option value="" disabled>Select a finding to upload evidence for...</option>
            {openFindings.map((f:any) => (
              <option key={f.id} value={f.id}>
                [{f.severity}] {f.title} — {f.status.replace(/_/g,' ')} ({f.org?.shortCode})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(148,163,184,0.35)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search filename or finding..."
            className="gov-input" style={{ paddingLeft:30, fontSize:12 }}/>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="gov-input" style={{ width:'auto', padding:'8px 12px', fontSize:12 }}>
          <option value="">All Types</option>
          {['SCREENSHOT','LOG_FILE','REPORT','CONFIGURATION','VIDEO','OTHER'].map(t =>
            <option key={t} value={t}>{t.replace('_',' ')}</option>
          )}
        </select>
        {(search||filterType) && (
          <button onClick={() => { setSearch(''); setFilterType(''); }} className="btn btn-ghost" style={{ padding:'8px 12px', fontSize:11 }}>
            <X size={10}/>Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card">
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <FileText size={14} color="#34d399"/>
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>Evidence Files</span>
          <span style={{ fontSize:10, color:'rgba(148,163,184,0.35)', fontFamily:'IBM Plex Mono,monospace' }}>{filtered.length}</span>
        </div>

        {(el||fl) ? (
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
            {[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:52, animationDelay:`${i*60}ms` }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'60px 0', textAlign:'center' }}>
            <Shield size={40} style={{ margin:'0 auto 14px', display:'block', color:'rgba(148,163,184,0.08)' }}/>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:16, color:'rgba(148,163,184,0.3)', marginBottom:6 }}>
              {evidence.length === 0 ? 'No evidence uploaded yet' : 'No matches'}
            </div>
            {canUpload && evidence.length === 0 && (
              <div style={{ fontSize:12, color:'rgba(148,163,184,0.2)' }}>Use the selector above to upload your first evidence file</div>
            )}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="gov-table" style={{ minWidth:720 }}>
              <thead>
                <tr>
                  <th>Type</th><th>Filename</th><th>Finding</th>
                  <th>Uploaded By</th><th>Date & Time</th><th>Hash</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e:any, i:number) => {
                  const ec = EV_COLORS[e.evidenceType] || EV_COLORS.OTHER;
                  return (
                    <tr key={e.id} style={{ animation:`fadeUp 0.2s ease ${i*25}ms both` }}>
                      <td>
                        <span style={{ padding:'2px 7px', borderRadius:4, fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, background:ec.bg, color:ec.color, border:`1px solid ${ec.border}`, whiteSpace:'nowrap' }}>
                          {e.evidenceType?.replace('_',' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize:12, color:'rgba(148,163,184,0.85)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.originalFilename}</div>
                        {e.description && <div style={{ fontSize:10, color:'rgba(148,163,184,0.4)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize:11, color:'rgba(148,163,184,0.7)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.findingTitle}</div>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:`${SEV_CLR[e.findingSeverity]}15`, color:SEV_CLR[e.findingSeverity], border:`1px solid ${SEV_CLR[e.findingSeverity]}25`, fontFamily:'Rajdhani,sans-serif', fontWeight:700 }}>
                          {e.findingSeverity}
                        </span>
                        <span style={{ fontSize:9, color:'rgba(148,163,184,0.3)', fontFamily:'IBM Plex Mono,monospace', marginLeft:5 }}>{e.orgShortCode}</span>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:24, height:24, borderRadius:6, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:'#60a5fa', flexShrink:0 }}>
                            {e.uploadedBy?.name?.slice(0,2).toUpperCase()||'U'}
                          </div>
                          <div>
                            <div style={{ fontSize:11, color:'rgba(148,163,184,0.8)' }}>{e.uploadedBy?.name||'Unknown'}</div>
                            <div style={{ fontSize:9.5, color:'rgba(148,163,184,0.35)', fontFamily:'IBM Plex Mono,monospace' }}>{e.uploadedBy?.role||'—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)', whiteSpace:'nowrap' }}>{fmtDT(e.createdAt)}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'rgba(59,130,246,0.55)' }}>
                          {e.fileHash?.slice(0,14)}...
                        </span>
                      </td>
                      <td>
                        <button onClick={() => setSelected(e)} className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:10 }}>
                          <Eye size={10}/>View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <UploadModal findingId={modal.findingId} findingTitle={modal.title} onClose={() => setModal(null)} onSuccess={handleSuccess}/>}
      {selected && <EvidenceDrawer item={selected} onClose={() => setSelected(null)}/>}

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
