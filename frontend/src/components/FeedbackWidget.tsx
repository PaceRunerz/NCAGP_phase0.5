'use client';
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, AlertTriangle, Bug, Lightbulb, MessageSquare, CheckCircle2, Clock, Trash2, Lock, Shield } from 'lucide-react';

type IssueType = 'urgent'|'bug'|'suggestion'|'general';   srt

const TYPES = [
  { value:'urgent'     as IssueType, label:'Urgent',    icon:AlertTriangle,  color:'#f87171', bg:'rgba(239,68,68,0.1)',   border:'rgba(239,68,68,0.25)'   },
  { value:'bug'        as IssueType, label:'Bug Report', icon:Bug,            color:'#fbbf24', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)'  },
  { value:'suggestion' as IssueType, label:'Suggestion', icon:Lightbulb,      color:'#60a5fa', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.25)'  },
  { value:'general'   as IssueType,  label:'General',   icon:MessageSquare,  color:'#34d399', bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)'  },
];

interface Issue {
  id:string; type:IssueType; title:string; description:string;
  status:'open'|'resolved'; submittedAt:string; submittedBy:string;
}

export function FeedbackWidget() {
  const [mounted,    setMounted]   = useState(false);
  const [loggedIn,   setLoggedIn]  = useState(false);
  const [isAdmin,    setIsAdmin]   = useState(false);
  const [open,       setOpen]      = useState(false);
  const [tab,        setTab]       = useState<'report'|'history'>('report');
  const [type,       setType]      = useState<IssueType>('bug');
  const [title,      setTitle]     = useState('');
  const [desc,       setDesc]      = useState('');
  const [submitting, setSubmitting]= useState(false);
  const [submitted,  setSubmitted] = useState(false);
  const [issues,     setIssues]    = useState<Issue[]>([]);
  const [toast,      setToast]     = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('ncagp_token');
    setLoggedIn(!!token);

    try {
      const user = JSON.parse(localStorage.getItem('ncagp_user') || '{}');
      // Only NIC_ADMIN can manage (delete/resolve) feedback
      setIsAdmin(user.role === 'NIC_ADMIN');
    } catch {}

    try {
      const raw = localStorage.getItem('ncagp_feedback_issues');
      if (raw) setIssues(JSON.parse(raw));
    } catch {}

    const pollId = setInterval(() => {
      setLoggedIn(!!localStorage.getItem('ncagp_token'));
      try {
        const u = JSON.parse(localStorage.getItem('ncagp_user') || '{}');
        setIsAdmin(u.role === 'NIC_ADMIN');
      } catch {}
    }, 2000);
    return () => clearInterval(pollId);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('ncagp_feedback_issues', JSON.stringify(issues));
  }, [issues, mounted]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key==='Escape'&&open) setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  if (!mounted || !loggedIn) return null;

  const openCount = issues.filter(i => i.status === 'open').length;

  const handleSubmit = async () => {
    if (!title.trim() || !desc.trim()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 700));
    const user = (() => { try { return JSON.parse(localStorage.getItem('ncagp_user') || '{}'); } catch { return {}; } })();
    const ni: Issue = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type, title:title.trim(), description:desc.trim(),
      status:'open', submittedAt:new Date().toISOString(),
      submittedBy: user.email || user.name || 'anonymous',
    };
    setIssues(p => [ni, ...p]);
    setTitle(''); setDesc('');
    setSubmitting(false); setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setTab('history'); }, 1800);
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false });

  return (
    <>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,4,12,0.75)', backdropFilter:'blur(4px)', zIndex:399 }}/>
      )}

      {/* FAB */}
      <div className="feedback-fab">
        <div style={{ position:'relative' }}>
          <button className={`feedback-fab-btn${open?' open':''}`} onClick={() => setOpen(o => !o)} aria-label="Feedback">
            {open ? <X size={19} color="white"/> : <MessageCircle size={19} color="white"/>}
          </button>
          {!open && openCount > 0 && <div className="fab-badge">{openCount}</div>}
        </div>
        {!open && (
          <div style={{ textAlign:'center', marginTop:5, fontSize:8, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.1em', color:'rgba(148,163,184,0.35)', textTransform:'uppercase' }}>
            Feedback
          </div>
        )}
      </div>

      {open && (
        <div className="feedback-panel">
          {/* Header */}
          <div className="fp-header">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <MessageCircle size={14} color="#60a5fa"/>
                </div>
                <div>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:15, color:'#f0f4ff' }}>Report an Issue</div>
                  <div style={{ fontSize:10, color:'rgba(148,163,184,0.4)' }}>NCAGP Support · NIC GOV.IN</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, color:'rgba(148,163,184,0.5)', width:27, height:27, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as any).style.background='rgba(239,68,68,0.1)'; (e.currentTarget as any).style.color='#f87171'; }}
                onMouseLeave={e => { (e.currentTarget as any).style.background='rgba(255,255,255,0.05)'; (e.currentTarget as any).style.color='rgba(148,163,184,0.5)'; }}>
                <X size={13}/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="fp-tabs">
            {(['report','history'] as const).map(t => (
              <button key={t} className={`fp-tab${tab===t?' active':''}`} onClick={() => setTab(t)}>
                {t==='history' ? `History${issues.length>0?` (${issues.length})`:'' }` : 'Report'}
              </button>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, paddingBottom:4 }}>
              <div className="live-dot" style={{ width:5, height:5 }}/>
              <span style={{ fontSize:9, color:'rgba(148,163,184,0.25)', fontFamily:'IBM Plex Mono,monospace' }}>online</span>
            </div>
          </div>

          {/* Body */}
          <div className="fp-body">

            {/* REPORT TAB */}
            {tab==='report' && (
              submitted ? (
                <div style={{ textAlign:'center', padding:'28px 0' }} className="anim-pop-in">
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.28)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                    <CheckCircle2 size={22} color="#34d399"/>
                  </div>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:17, color:'#34d399', marginBottom:4 }}>Issue Logged!</div>
                  <div style={{ fontSize:12, color:'rgba(148,163,184,0.45)' }}>Switching to history...</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }} className="anim-fade-in">
                  <div>
                    <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:7 }}>Issue Type</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {TYPES.map(t => {
                        const TIcon = t.icon; const active = type===t.value;
                        return (
                          <button key={t.value} onClick={() => setType(t.value)}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                              background:active?t.bg:'rgba(255,255,255,0.03)', border:`1.5px solid ${active?t.border:'rgba(255,255,255,0.06)'}`,
                              transform:active?'scale(1.02)':'scale(1)' }}>
                            <TIcon size={13} color={active?t.color:'rgba(148,163,184,0.35)'} style={{ flexShrink:0 }}/>
                            <span style={{ fontSize:12, fontFamily:'Rajdhani,sans-serif', fontWeight:700, color:active?t.color:'rgba(148,163,184,0.5)' }}>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {type==='urgent' && (
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8 }} className="anim-fade-in">
                      <AlertTriangle size={12} color="#f87171" style={{ flexShrink:0 }}/>
                      <span style={{ fontSize:11, color:'#f87171', lineHeight:1.4 }}>Marked urgent — escalated to NIC_ADMIN</span>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:6 }}>Title</div>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary of the issue" className="gov-input" style={{ fontSize:13 }}/>
                  </div>

                  <div>
                    <div style={{ fontSize:9.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.4)', marginBottom:6 }}>Description</div>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What happened? What did you expect?" rows={4}
                      style={{ width:'100%', padding:'9px 12px', background:'rgba(1,10,22,0.7)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#f0f4ff', fontSize:12.5, fontFamily:'IBM Plex Sans,sans-serif', outline:'none', resize:'vertical', lineHeight:1.6, transition:'border-color 0.15s' }}
                      onFocus={e => (e.target.style.borderColor='rgba(59,130,246,0.5)')}
                      onBlur={e  => (e.target.style.borderColor='rgba(255,255,255,0.08)')}
                    />
                  </div>

                  <button onClick={handleSubmit} disabled={!title.trim()||!desc.trim()||submitting} className="btn btn-primary"
                    style={{ width:'100%', justifyContent:'center', opacity:!title.trim()||!desc.trim()?0.45:1 }}>
                    {submitting
                      ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>Submitting...</>
                      : <><Send size={12}/>Submit Issue</>
                    }
                  </button>
                </div>
              )
            )}

            {/* HISTORY TAB */}
            {tab==='history' && (
              <div className="anim-fade-in">
                {/* Admin notice */}
                {!isAdmin && (
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:'rgba(148,163,184,0.05)', border:'1px solid rgba(148,163,184,0.12)', borderRadius:7, marginBottom:10, fontSize:11, color:'rgba(148,163,184,0.45)' }}>
                    <Lock size={11} style={{ flexShrink:0 }}/>
                    Only NIC_ADMIN can resolve or delete issues
                  </div>
                )}
                {isAdmin && (
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:7, marginBottom:10, fontSize:11, color:'rgba(167,139,250,0.7)' }}>
                    <Shield size={11} style={{ flexShrink:0 }}/>
                    Admin view — you can resolve and delete issues
                  </div>
                )}

                {issues.length===0 ? (
                  <div style={{ textAlign:'center', padding:'36px 0' }}>
                    <MessageCircle size={36} style={{ margin:'0 auto 12px', display:'block', color:'rgba(148,163,184,0.1)' }}/>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:14, color:'rgba(148,163,184,0.3)', marginBottom:8 }}>No issues reported yet</div>
                    <button onClick={() => setTab('report')} className="btn btn-primary" style={{ fontSize:10 }}>Report First Issue</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {/* Stats */}
                    <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                      <div style={{ flex:1, padding:'8px 12px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:22, color:'#fbbf24' }}>{openCount}</div>
                        <div style={{ fontSize:9, color:'rgba(245,158,11,0.5)', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Rajdhani,sans-serif' }}>Open</div>
                      </div>
                      <div style={{ flex:1, padding:'8px 12px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:22, color:'#34d399' }}>{issues.length-openCount}</div>
                        <div style={{ fontSize:9, color:'rgba(52,211,153,0.5)', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Rajdhani,sans-serif' }}>Resolved</div>
                      </div>
                    </div>

                    {issues.map((issue, i) => {
                      const t = TYPES.find(x => x.value===issue.type) || TYPES[3];
                      const IIcon = t.icon;
                      return (
                        <div key={issue.id}
                          style={{ background:issue.status==='resolved'?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.04)', border:`1px solid ${issue.status==='resolved'?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.07)'}`, borderRadius:10, padding:'10px 12px', opacity:issue.status==='resolved'?0.65:1 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                            <div style={{ width:28, height:28, borderRadius:7, background:t.bg, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                              <IIcon size={12} color={t.color}/>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                                <span style={{ fontSize:12.5, fontWeight:500, color:issue.status==='resolved'?'rgba(148,163,184,0.5)':'#f0f4ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{issue.title}</span>
                                <span style={{ fontSize:8.5, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.08em', padding:'1px 6px', borderRadius:3, flexShrink:0,
                                  background:issue.status==='resolved'?'rgba(52,211,153,0.1)':'rgba(245,158,11,0.1)',
                                  color:issue.status==='resolved'?'#34d399':'#fbbf24',
                                  border:`1px solid ${issue.status==='resolved'?'rgba(52,211,153,0.2)':'rgba(245,158,11,0.2)'}`,
                                }}>
                                  {issue.status.toUpperCase()}
                                </span>
                              </div>
                              <div style={{ fontSize:11, color:'rgba(148,163,184,0.4)', lineHeight:1.4, marginBottom:6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                                {issue.description}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9.5, color:'rgba(148,163,184,0.3)', fontFamily:'IBM Plex Mono,monospace' }}>
                                  <Clock size={9}/>{fmt(issue.submittedAt)}
                                </div>

                                {/* Action buttons — ONLY for NIC_ADMIN */}
                                {isAdmin && (
                                  <div style={{ display:'flex', gap:5 }}>
                                    {issue.status==='open' && (
                                      <button onClick={() => {
                                        setIssues(p => p.map(i => i.id===issue.id ? {...i,status:'resolved' as const} : i));
                                        setToast('Marked as resolved');
                                      }} style={{ padding:'3px 8px', borderRadius:5, background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.2)', color:'#34d399', fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.06em', cursor:'pointer', textTransform:'uppercase' }}>
                                        Resolve
                                      </button>
                                    )}
                                    <button onClick={() => {
                                      setIssues(p => p.filter(i => i.id!==issue.id));
                                      setToast('Issue deleted');
                                    }} style={{ padding:'3px 6px', borderRadius:5, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center' }}>
                                      <Trash2 size={9}/>
                                    </button>
                                  </div>
                                )}

                                {/* Non-admin just sees submitted by */}
                                {!isAdmin && (
                                  <span style={{ fontSize:9.5, color:'rgba(148,163,184,0.25)', fontFamily:'IBM Plex Mono,monospace' }}>{issue.submittedBy}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="fp-footer">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:8.5, color:'rgba(148,163,184,0.2)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'0.08em', textTransform:'uppercase' }}>NCAGP Support System</span>
              <span style={{ fontSize:9, color:'rgba(148,163,184,0.2)', fontFamily:'IBM Plex Mono,monospace' }}>{issues.length} total</span>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast toast-success">
          <CheckCircle2 size={14}/>{toast}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.4);opacity:0}} @keyframes popIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}} @keyframes toastSlide{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}`}</style>
    </>
  );
}
