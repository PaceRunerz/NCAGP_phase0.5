'use client';
import { useState, useCallback } from 'react';
import {
  FileText, Upload, CheckCircle2, AlertTriangle,
  RefreshCw, Shield, Eye, Hash, X, FileCheck,
  Lock, Image, File, Search,
} from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

const EV_CLR: Record<string,{color:string;bg:string;border:string}> = {
  SCREENSHOT:    {color:'#60a5fa',bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.25)'},
  LOG_FILE:      {color:'#a78bfa',bg:'rgba(167,139,250,0.1)', border:'rgba(167,139,250,0.25)'},
  REPORT:        {color:'#34d399',bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)'},
  CONFIGURATION: {color:'#fbbf24',bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)'},
  VIDEO:         {color:'#fb923c',bg:'rgba(249,115,22,0.1)',  border:'rgba(249,115,22,0.25)'},
  OTHER:         {color:'#94a3b8',bg:'rgba(148,163,184,0.08)',border:'rgba(148,163,184,0.18)'},
};
const SEV_CLR:Record<string,string>={CRITICAL:'#f87171',HIGH:'#fb923c',MEDIUM:'#fbbf24',LOW:'#94a3b8',INFO:'#60a5fa'};

function fmtDT(d:string){
  if(!d) return '—';
  return new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'})+' IST';
}

// ── Upload modal - fixed at TOP of screen ─────────────────────────
function UploadModal({findingId,findingTitle,onClose,onSuccess}:{findingId:string;findingTitle:string;onClose:()=>void;onSuccess:()=>void}) {
  const [file,      setFile]     = useState<File|null>(null);
  const [evType,    setEvType]   = useState('SCREENSHOT');
  const [desc,      setDesc]     = useState('');
  const [hash,      setHash]     = useState('');
  const [uploading, setUploading]= useState(false);
  const [hashing,   setHashing]  = useState(false);
  const [error,     setError]    = useState('');
  const [success,   setSuccess]  = useState(false);

  const handleFile = async (f:File) => {
    setFile(f); setHashing(true);
    const buf = await f.arrayBuffer();
    const d   = await crypto.subtle.digest('SHA-256',buf);
    setHash(Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join(''));
    setHashing(false);
  };

  const submit = async () => {
    if(!file||!desc.trim()) return;
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file',file); fd.append('evidenceType',evType);
      fd.append('description',desc); fd.append('clientHash',hash);
      const res = await fetch(`/api/findings/${findingId}/evidence`,{
        method:'POST',
        headers:{Authorization:`Bearer ${localStorage.getItem('ncagp_token')}`},
        body:fd,
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.message||'Upload failed');
      setSuccess(true);
      setTimeout(()=>{onSuccess();onClose();},1400);
    } catch(e:any){setError(e.message);}
    finally{setUploading(false);}
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,4,12,0.85)',backdropFilter:'blur(8px)',zIndex:1000}}/>

      {/* Modal — anchored to TOP of viewport, not center */}
      <div style={{
        position:'fixed',
        top:24,                    /* 24px from top */
        left:'50%',
        transform:'translateX(-50%)',
        width:'min(460px,calc(100vw - 48px))',
        maxHeight:'calc(100vh - 48px)',
        overflowY:'auto',
        background:'linear-gradient(160deg,rgba(3,16,36,0.98),rgba(1,10,24,0.99))',
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:16,
        padding:22,
        zIndex:1001,
        boxShadow:'0 40px 100px rgba(0,0,0,0.8)',
      }} className="anim-pop-in">
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.6),transparent)'}}/>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18}}>
          <div>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:16,color:'#f0f4ff'}}>Upload Evidence</div>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.4)',marginTop:2,maxWidth:360,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{findingTitle}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'rgba(148,163,184,0.5)',width:27,height:27,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <X size={13}/>
          </button>
        </div>

        {success ? (
          <div style={{textAlign:'center',padding:'28px 0'}} className="anim-pop-in">
            <div style={{width:50,height:50,borderRadius:'50%',background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <CheckCircle2 size={22} color="#34d399"/>
            </div>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:17,color:'#34d399',marginBottom:4}}>Evidence Uploaded!</div>
            <div style={{fontSize:12,color:'rgba(148,163,184,0.4)'}}>Now visible in the Evidence Portal</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:13}}>
            {/* Type */}
            <div>
              <div style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:6}}>Evidence Type</div>
              <select value={evType} onChange={e=>setEvType(e.target.value)} className="gov-input" style={{fontSize:12}}>
                {['SCREENSHOT','LOG_FILE','REPORT','CONFIGURATION','VIDEO','OTHER'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
            </div>

            {/* File */}
            <div>
              <div style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:6}}>File *</div>
              <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'18px 14px',background:file?'rgba(52,211,153,0.05)':'rgba(1,10,22,0.5)',border:`2px dashed ${file?'rgba(52,211,153,0.45)':'rgba(255,255,255,0.1)'}`,borderRadius:10,cursor:'pointer',transition:'all 0.15s',gap:6}}>
                <input type="file" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);}}/>
                {file?(
                  <><FileCheck size={20} color="#34d399"/>
                  <div style={{fontSize:12,color:'#34d399',fontWeight:500,textAlign:'center',wordBreak:'break-all'}}>{file.name}</div>
                  <div style={{fontSize:10,color:'rgba(148,163,184,0.4)'}}>{(file.size/1024/1024).toFixed(2)} MB</div></>
                ):(
                  <><Upload size={20} color="rgba(148,163,184,0.3)"/>
                  <div style={{fontSize:12,color:'rgba(148,163,184,0.4)'}}>Click to select file</div>
                  <div style={{fontSize:10,color:'rgba(148,163,184,0.25)'}}>PNG, JPG, PDF, LOG, ZIP — max 50 MB</div></>
                )}
              </label>
            </div>

            {hashing&&<div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'rgba(148,163,184,0.4)'}}>
              <div style={{width:11,height:11,border:'2px solid rgba(59,130,246,0.3)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Computing SHA-256...
            </div>}
            {hash&&!hashing&&<div style={{padding:'9px 11px',background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:7}}>
              <div style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',color:'rgba(59,130,246,0.5)',marginBottom:3}}>SHA-256 (browser)</div>
              <div style={{fontSize:10,fontFamily:'IBM Plex Mono,monospace',color:'#60a5fa',wordBreak:'break-all'}}>{hash}</div>
            </div>}

            {/* Description */}
            <div>
              <div style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:6}}>What does this prove? *</div>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
                placeholder="Describe what this file demonstrates..."
                style={{width:'100%',padding:'9px 12px',background:'rgba(1,10,22,0.7)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:'#f0f4ff',fontSize:12,fontFamily:'IBM Plex Sans,sans-serif',outline:'none',resize:'vertical',lineHeight:1.6,transition:'border-color 0.15s'}}
                onFocus={e=>(e.target.style.borderColor='rgba(59,130,246,0.5)')}
                onBlur={e=>(e.target.style.borderColor='rgba(255,255,255,0.08)')}/>
            </div>

            {error&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,color:'#f87171',fontSize:11}}>
              <AlertTriangle size={12}/>{error}
            </div>}

            <div style={{display:'flex',alignItems:'flex-start',gap:7,padding:'8px 11px',background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.15)',borderRadius:7,fontSize:10,color:'rgba(245,158,11,0.55)',lineHeight:1.5}}>
              <Lock size={10} style={{flexShrink:0,marginTop:1}}/>Evidence is <strong>permanently immutable</strong> once uploaded.
            </div>

            <div style={{display:'flex',gap:10}}>
              <button onClick={onClose} className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}>Cancel</button>
              <button onClick={submit} disabled={!file||!desc.trim()||uploading||hashing} className="btn btn-primary"
                style={{flex:2,justifyContent:'center',opacity:(!file||!desc.trim())?0.45:1}}>
                {uploading
                  ?<><div style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Uploading...</>
                  :<><Shield size={12}/>Upload Securely</>}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ── Evidence viewer drawer ────────────────────────────────────────
function EvidenceDrawer({item,onClose}:{item:any;onClose:()=>void}) {
  const [verifying,setVerifying]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [previewUrl,setPreviewUrl]=useState('');
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');

  const ec = EV_CLR[item.evidenceType]||EV_CLR.OTHER;
  const isImage = item.mimeType?.startsWith('image/');
  const isPdf   = item.mimeType==='application/pdf';

  const loadPreview = async () => {
    if(previewUrl) return;
    setLoading(true);
    setLoadError('');
    try {
      const token = localStorage.getItem('ncagp_token');
      const res = await fetch(`/api/evidence/${item.id}/file`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok) {
        const errData = await res.json().catch(()=>({}));
        // Instead of throwing an error, we gracefully set the UI state and return
        if(errData.message?.includes('FILE_DELETED')) {
          setLoadError('This file has been securely removed from the server for data retention or security reasons. The database record remains intact for audit purposes.');
        } else {
          setLoadError('Cannot load file. It may have been moved or removed.');
        }
        setLoading(false);
        return; 
      }
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch(e:any){
      console.error("Preview error:", e);
      setLoadError("A network error occurred while loading the file.");
    }
    setLoading(false);
  };

  const verify = async () => {
    setVerifying(true);
    try{setResult(await apiFetch(`/api/evidence/${item.id}/verify`));}
    catch{setResult({isIntact:false});}
    setVerifying(false);
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="drawer">
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${ec.color}50,transparent)`}}/>

        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
          <div style={{flex:1,minWidth:0}}>
            <span style={{padding:'3px 9px',borderRadius:4,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,background:ec.bg,color:ec.color,border:`1px solid ${ec.border}`}}>
              {item.evidenceType?.replace('_',' ')}
            </span>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:15,fontWeight:700,color:'#f0f4ff',marginTop:8,wordBreak:'break-all'}}>{item.originalFilename||item.fileName}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,color:'rgba(148,163,184,0.5)',width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>×</button>
        </div>

        {/* Key info */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
          {[
            {label:'Uploaded By',value:item.uploadedBy?.name||'Unknown'},
            {label:'Role',       value:item.uploadedBy?.role||'—'},
            {label:'Date & Time',value:fmtDT(item.uploadedAt||item.createdAt)},
            {label:'Size',       value:item.fileSize?`${(item.fileSize/1024/1024).toFixed(2)} MB`:'—'},
          ].map(({label,value})=>(
            <div key={label} style={{background:'rgba(2,13,26,0.5)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:7,padding:'9px 11px'}}>
              <div style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(148,163,184,0.3)',marginBottom:3}}>{label}</div>
              <div style={{fontSize:12,color:'rgba(148,163,184,0.8)',wordBreak:'break-all'}}>{value}</div>
            </div>
          ))}
        </div>

        {item.description&&<div style={{padding:'10px 12px',background:'rgba(1,10,22,0.4)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:8,marginBottom:12}}>
          <div style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(148,163,184,0.3)',marginBottom:4}}>What This Proves</div>
          <div style={{fontSize:12,color:'rgba(148,163,184,0.7)',lineHeight:1.6}}>{item.description}</div>
        </div>}

        {/* Hash */}
        <div style={{padding:'10px 12px',background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:8,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
            <Hash size={11} color="#60a5fa"/>
            <span style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',color:'rgba(59,130,246,0.5)'}}>SHA-256 HASH</span>
          </div>
          <div style={{fontSize:10,fontFamily:'IBM Plex Mono,monospace',color:'#60a5fa',wordBreak:'break-all',lineHeight:1.6}}>
            {item.fileHash||item.sha256Hash}
          </div>
        </div>

        {/* Verification result */}
        {result&&<div style={{padding:'10px 12px',background:result.isIntact?'rgba(52,211,153,0.06)':'rgba(239,68,68,0.08)',border:`1px solid ${result.isIntact?'rgba(52,211,153,0.2)':'rgba(239,68,68,0.2)'}`,borderRadius:8,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:result.isIntact?'#34d399':'#f87171',fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>
            {result.isIntact?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>}
            {result.isIntact?'HASH VERIFIED — No tampering detected':'HASH MISMATCH — File may have been tampered with or removed'}
          </div>
        </div>}

        {/* Load Error Banner */}
        {loadError && (
          <div style={{padding:'10px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,marginBottom:12}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:'#f87171',fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>
              <AlertTriangle size={14} style={{marginTop:1,flexShrink:0}}/>
              <span>{loadError}</span>
            </div>
          </div>
        )}

        {/* Inline preview */}
        {!loadError && (isImage||isPdf) && (
          <div style={{marginBottom:12}}>
            {!previewUrl?(
              <button onClick={loadPreview} disabled={loading} className="btn btn-ghost" style={{width:'100%',justifyContent:'center',fontSize:11}}>
                {loading
                  ?<><div style={{width:11,height:11,border:'1.5px solid rgba(148,163,184,0.3)',borderTopColor:'#94a3b8',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Loading preview...</>
                  :<><Eye size={11}/>{isImage?'Preview Image':'Preview PDF'}</>}
              </button>
            ):isImage?(
              <div style={{borderRadius:8,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}>
                <img src={previewUrl} alt="evidence" style={{width:'100%',display:'block',maxHeight:300,objectFit:'contain',background:'rgba(1,10,22,0.5)'}}/>
              </div>
            ):(
              <iframe src={previewUrl} style={{width:'100%',height:300,border:'1px solid rgba(255,255,255,0.08)',borderRadius:8}} title="PDF preview"/>
            )}
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={verify} disabled={verifying} className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}>
            {verifying
              ?<><div style={{width:11,height:11,border:'1.5px solid rgba(148,163,184,0.3)',borderTopColor:'#94a3b8',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Verifying...</>
              :<><Hash size={11}/>Verify Hash</>}
          </button>
          {previewUrl&&(
            <a href={previewUrl} download={item.fileName||item.originalFilename} className="btn btn-primary" style={{flex:1,justifyContent:'center',textDecoration:'none'}}>
              Download
            </a>
          )}
          {!previewUrl&&item.storageRef&&!loadError&&(
            <button onClick={loadPreview} className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>
              <Eye size={11}/>View File
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function EvidencePage() {
  const [search,   setSearch]  = useState('');
  const [filter,   setFilter]  = useState('');
  const [modal,    setModal]   = useState<{findingId:string;title:string}|null>(null);
  const [selected, setSelected]= useState<any>(null);
  const user = (() => { try{return JSON.parse(localStorage.getItem('ncagp_user')||'{}')}catch{return{}} })();
  const canUpload = ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY','AUDITOR','VENDOR_ADMIN'].includes(user?.role);

  // Single API call — fetches everything at once
  const {data:evidence, loading, refresh} = useData<any[]>(
    useCallback(()=>apiFetch('/api/evidence'),[]),
    [], {refreshOnFocus:true,refreshOnVisible:true}
  );

  // Load findings for upload selector
  const {data:findingsData} = useData<any>(
    useCallback(()=>apiFetch('/api/findings?limit=200'),[]),
    [], {refreshOnFocus:true}
  );

  const all      = evidence||[];
  const findings = findingsData?.findings||[];
  const open     = findings.filter((f:any)=>!['CLOSED','FALSE_POSITIVE'].includes(f.status));

  const filtered = all.filter((e:any)=>{
    const ms = !search||e.originalFilename?.toLowerCase().includes(search.toLowerCase())||e.findingTitle?.toLowerCase().includes(search.toLowerCase());
    const mt = !filter||e.evidenceType===filter;
    return ms&&mt;
  });

  return (
    <div style={{padding:24,position:'relative',zIndex:1}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}} className="anim-fade-up">
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:36,height:36,borderRadius:9,background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Shield size={17} color="#34d399"/>
            </div>
            <h1 style={{fontFamily:'Rajdhani,sans-serif',fontSize:22,fontWeight:700}}>Evidence Portal</h1>
          </div>
          <p style={{fontSize:11,color:'rgba(148,163,184,0.4)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
            Immutable · SHA-256 verified · {all.length} files
          </p>
        </div>
        <button onClick={refresh} className="btn btn-ghost" style={{fontSize:11}}><RefreshCw size={11}/>Refresh</button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}} className="stagger">
        {[
          {label:'Total Files',      value:all.length,                                                color:'#60a5fa'},
          {label:'Findings Covered', value:new Set(all.map((e:any)=>e.findingId)).size,               color:'#34d399'},
          {label:'Without Evidence', value:open.filter((f:any)=>f._count?.evidence===0).length,       color:'#fbbf24'},
          {label:'Types Used',       value:new Set(all.map((e:any)=>e.evidenceType)).size,            color:'#a78bfa'},
        ].map(({label,value,color})=>(
          <div key={label} className="stat-card anim-fade-up">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{color}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Upload selector */}
      {canUpload&&(
        <div className="glass-card" style={{padding:'16px 20px',marginBottom:16}}>
          <div style={{fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:10}}>
            Upload Evidence for a Finding
          </div>
          <select className="gov-input" style={{fontSize:12}} defaultValue=""
            onChange={e=>{
              const f=findings.find((fi:any)=>fi.id===e.target.value);
              if(f) setModal({findingId:f.id,title:f.title});
              e.target.value='';
            }}>
            <option value="" disabled>Select a finding to upload evidence for...</option>
            {open.map((f:any)=>(
              <option key={f.id} value={f.id}>[{f.severity}] {f.title} — {f.status.replace(/_/g,' ')} ({f.org?.shortCode})</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <div style={{position:'relative',flex:1}}>
          <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(148,163,184,0.35)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search filename or finding..."
            className="gov-input" style={{paddingLeft:30,fontSize:12}}/>
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="gov-input" style={{width:'auto',padding:'8px 12px',fontSize:12}}>
          <option value="">All Types</option>
          {['SCREENSHOT','LOG_FILE','REPORT','CONFIGURATION','VIDEO','OTHER'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
        </select>
        {(search||filter)&&<button onClick={()=>{setSearch('');setFilter('');}} className="btn btn-ghost" style={{padding:'8px 12px',fontSize:11}}><X size={10}/>Clear</button>}
      </div>

      {/* Table */}
      <div className="glass-card">
        <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:8}}>
          <FileText size={14} color="#34d399"/>
          <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14}}>Evidence Files</span>
          <span style={{fontSize:10,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{filtered.length}</span>
        </div>

        {loading?(
          <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
            {[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:52,animationDelay:`${i*60}ms`}}/>)}
          </div>
        ):filtered.length===0?(
          <div style={{padding:'60px 0',textAlign:'center'}}>
            <Shield size={40} style={{margin:'0 auto 14px',display:'block',color:'rgba(148,163,184,0.07)'}}/>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:16,color:'rgba(148,163,184,0.3)',marginBottom:6}}>
              {all.length===0?'No evidence uploaded yet':'No matches'}
            </div>
            {canUpload&&all.length===0&&<div style={{fontSize:12,color:'rgba(148,163,184,0.2)'}}>Use the selector above to upload the first evidence file</div>}
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table className="gov-table" style={{minWidth:760}}>
              <thead><tr><th>Type</th><th>Filename</th><th>Finding</th><th>Uploaded By</th><th>Date & Time</th><th>Hash</th><th></th></tr></thead>
              <tbody>
                {filtered.map((e:any,i:number)=>{
                  const ec=EV_CLR[e.evidenceType]||EV_CLR.OTHER;
                  return (
                    <tr key={e.id} style={{animation:`fadeUp 0.2s ease ${i*25}ms both`}}>
                      <td><span style={{padding:'2px 7px',borderRadius:4,fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,background:ec.bg,color:ec.color,border:`1px solid ${ec.border}`,whiteSpace:'nowrap'}}>{e.evidenceType?.replace('_',' ')}</span></td>
                      <td>
                        <div style={{fontSize:12,color:'rgba(148,163,184,0.85)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.originalFilename||e.fileName}</div>
                        {e.description&&<div style={{fontSize:10,color:'rgba(148,163,184,0.4)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.description}</div>}
                      </td>
                      <td>
                        <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',maxWidth:170,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.findingTitle}</div>
                        <div style={{display:'flex',gap:5,marginTop:2}}>
                          <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:`${SEV_CLR[e.findingSeverity]}15`,color:SEV_CLR[e.findingSeverity],border:`1px solid ${SEV_CLR[e.findingSeverity]}25`,fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>{e.findingSeverity}</span>
                          <span style={{fontSize:9,color:'rgba(148,163,184,0.3)',fontFamily:'IBM Plex Mono,monospace'}}>{e.orgShortCode}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{width:24,height:24,borderRadius:6,background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,color:'#60a5fa',flexShrink:0}}>
                            {e.uploadedBy?.name?.slice(0,2).toUpperCase()||'U'}
                          </div>
                          <div>
                            <div style={{fontSize:11,color:'rgba(148,163,184,0.8)'}}>{e.uploadedBy?.name||'Unknown'}</div>
                            <div style={{fontSize:9.5,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{e.uploadedBy?.role||'—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><div style={{fontSize:11,color:'rgba(148,163,184,0.6)',whiteSpace:'nowrap'}}>{fmtDT(e.uploadedAt||e.createdAt)}</div></td>
                      <td><span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,color:'rgba(59,130,246,0.5)'}}>{(e.fileHash||e.sha256Hash)?.slice(0,12)}...</span></td>
                      <td>
                        <button onClick={()=>setSelected(e)} className="btn btn-ghost" style={{padding:'5px 10px',fontSize:10}}>
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

      {modal&&<UploadModal findingId={modal.findingId} findingTitle={modal.title} onClose={()=>setModal(null)} onSuccess={refresh}/>}
      {selected&&<EvidenceDrawer item={selected} onClose={()=>setSelected(null)}/>}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}