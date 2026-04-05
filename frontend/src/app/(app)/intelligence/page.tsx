'use client';
import { useState } from 'react';
import { Brain, Search, AlertTriangle, TrendingUp, Send, Loader2, ChevronDown, ChevronUp, Shield, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/useData';

const SEV_CLR:Record<string,string>={CRITICAL:'#f87171',HIGH:'#fb923c',MEDIUM:'#fbbf24',LOW:'#94a3b8',INFO:'#60a5fa'};
const TREND_CLR:Record<string,string>={WORSENING:'#f87171',IMPROVING:'#34d399',STABLE:'#60a5fa'};

const EXAMPLE_QUERIES = [
  'Show all critical findings that are open and SLA breached',
  'List high severity findings from the last 30 days',
  'Find all recurring findings',
  'Show findings in remediation status',
  'List all open findings',
];

export default function IntelligencePage() {
  const [tab,       setTab]      = useState<'nlq'|'anomalies'|'forecast'>('nlq');
  const [query,     setQuery]    = useState('');
  const [loading,   setLoading]  = useState(false);
  const [nlqResult, setNlqResult]= useState<any>(null);
  const [anomalies, setAnomalies]= useState<any>(null);
  const [forecast,  setForecast] = useState<any>(null);
  const [expanded,  setExpanded] = useState<string|null>(null);

  const runQuery = async () => {
    if(!query.trim()) return;
    setLoading(true);
    try { setNlqResult(await apiFetch('/api/intelligence/query',{method:'POST',body:JSON.stringify({query})})); }
    catch(e:any) { setNlqResult({error:e.message}); }
    setLoading(false);
  };

  const runAnomalies = async () => {
    setLoading(true);
    try { setAnomalies(await apiFetch('/api/intelligence/anomalies',{method:'POST',body:'{}'})); }
    catch(e:any) { setAnomalies({error:e.message}); }
    setLoading(false);
  };

  const runForecast = async () => {
    setLoading(true);
    try { setForecast(await apiFetch('/api/intelligence/risk-forecast',{method:'POST',body:'{}'})); }
    catch(e:any) { setForecast({error:e.message}); }
    setLoading(false);
  };

  const ANOM_COLORS: Record<string,{color:string;bg:string}> = {
    SUSPICIOUS_FAST_CLOSURE: {color:'#f87171',bg:'rgba(239,68,68,0.08)'},
    HIGH_FALSE_POSITIVE_RATE:{color:'#fb923c',bg:'rgba(249,115,22,0.08)'},
    OFF_HOURS_EVIDENCE_UPLOAD:{color:'#fbbf24',bg:'rgba(245,158,11,0.08)'},
    EXCESSIVE_STATUS_CHANGES: {color:'#fb923c',bg:'rgba(249,115,22,0.08)'},
    CONTROL_DECAY:            {color:'#f87171',bg:'rgba(239,68,68,0.08)'},
  };

  return (
    <div style={{padding:24,position:'relative',zIndex:1}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}} className="anim-fade-up">
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:36,height:36,borderRadius:9,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Brain size={17} color="#a78bfa"/>
            </div>
            <h1 style={{fontFamily:'Rajdhani,sans-serif',fontSize:22,fontWeight:700}}>Intelligence Centre</h1>
          </div>
          <p style={{fontSize:11,color:'rgba(148,163,184,0.4)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
            NLQ · Anomaly Detection · Risk Forecast · PRD §Phase 2+
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'rgba(1,10,22,0.4)',padding:4,borderRadius:10,width:'fit-content'}}>
        {[
          {id:'nlq',      label:'Natural Language Query', icon:<Search size={12}/>},
          {id:'anomalies',label:'Anomaly Detection',      icon:<AlertTriangle size={12}/>},
          {id:'forecast', label:'Risk Forecast',          icon:<TrendingUp size={12}/>},
        ].map(({id,label,icon})=>(
          <button key={id} onClick={()=>setTab(id as any)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11.5,letterSpacing:'0.06em',textTransform:'uppercase',transition:'all 0.15s',
              background:tab===id?'linear-gradient(135deg,rgba(167,139,250,0.25),rgba(167,139,250,0.1))':'transparent',
              color:tab===id?'#a78bfa':'rgba(148,163,184,0.4)',
              boxShadow:tab===id?'0 1px 0 rgba(167,139,250,0.2)':'none',
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── NLQ TAB ── */}
      {tab==='nlq'&&(
        <div className="anim-fade-in">
          <div className="glass-card" style={{padding:20,marginBottom:16}}>
            <div style={{fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:10}}>
              Ask a question in plain English
            </div>
            <div style={{display:'flex',gap:10}}>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&runQuery()}
                placeholder={`e.g. "Show all critical findings that are SLA breached"`}
                className="gov-input" style={{flex:1,fontSize:13}}/>
              <button onClick={runQuery} disabled={!query.trim()||loading} className="btn btn-primary" style={{flexShrink:0}}>
                {loading?<Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>:<Send size={13}/>}
                Query
              </button>
            </div>

            {/* Example queries */}
            <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
              {EXAMPLE_QUERIES.map(q=>(
                <button key={q} onClick={()=>setQuery(q)}
                  style={{padding:'4px 10px',borderRadius:6,fontSize:10.5,cursor:'pointer',background:'rgba(167,139,250,0.07)',border:'1px solid rgba(167,139,250,0.15)',color:'rgba(167,139,250,0.6)',transition:'all 0.15s'}}
                  onMouseEnter={e=>{(e.currentTarget as any).style.background='rgba(167,139,250,0.15)';(e.currentTarget as any).style.color='#a78bfa';}}
                  onMouseLeave={e=>{(e.currentTarget as any).style.background='rgba(167,139,250,0.07)';(e.currentTarget as any).style.color='rgba(167,139,250,0.6)';}}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {nlqResult&&(
            <div className="glass-card anim-fade-in">
              {nlqResult.error?(
                <div style={{padding:20,color:'#f87171',fontSize:13}}>{nlqResult.error}</div>
              ):(
                <>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12}}>
                    <Brain size={14} color="#a78bfa"/>
                    <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14}}>Results</span>
                    <span style={{fontSize:10,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{nlqResult.count} findings</span>
                    <div style={{marginLeft:'auto',display:'flex',gap:6,flexWrap:'wrap'}}>
                      {Object.entries(nlqResult.filtersApplied||{}).map(([k,v]:any)=>(
                        <span key={k} style={{fontSize:9.5,padding:'2px 8px',borderRadius:4,background:'rgba(167,139,250,0.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.2)',fontFamily:'IBM Plex Mono,monospace'}}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <table className="gov-table">
                    <thead><tr><th>Severity</th><th>Finding</th><th>Org</th><th>Status</th><th>SLA</th></tr></thead>
                    <tbody>
                      {nlqResult.findings?.length===0?(
                        <tr><td colSpan={5} style={{padding:'32px 0',textAlign:'center',color:'rgba(148,163,184,0.3)'}}>No findings match this query</td></tr>
                      ):nlqResult.findings?.map((f:any,i:number)=>(
                        <tr key={f.id} style={{animation:`fadeUp 0.2s ease ${i*20}ms both`}}>
                          <td><span style={{padding:'2px 7px',borderRadius:4,fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,background:`${SEV_CLR[f.severity]}15`,color:SEV_CLR[f.severity],border:`1px solid ${SEV_CLR[f.severity]}25`}}>{f.severity}</span></td>
                          <td><div style={{fontSize:12,color:'rgba(148,163,184,0.85)',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.title}</div></td>
                          <td><span style={{fontSize:10,color:'rgba(148,163,184,0.4)',fontFamily:'IBM Plex Mono,monospace'}}>{f.org?.shortCode}</span></td>
                          <td><span style={{fontSize:11,fontFamily:'Rajdhani,sans-serif',fontWeight:600,color:'#60a5fa'}}>{f.status?.replace(/_/g,' ')}</span></td>
                          <td><span style={{fontSize:11,color:f.slaBreached?'#f87171':'rgba(148,163,184,0.4)'}}>{f.slaDate?new Date(f.slaDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'—'}{f.slaBreached&&' ⚠'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ANOMALIES TAB ── */}
      {tab==='anomalies'&&(
        <div className="anim-fade-in">
          <div style={{display:'flex',gap:10,marginBottom:16}}>
            <div className="glass-card" style={{padding:'16px 20px',flex:1}}>
              <div style={{fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:8}}>
                Rule-based anomaly detection — no ML required
              </div>
              <div style={{fontSize:12,color:'rgba(148,163,184,0.55)',lineHeight:1.6,marginBottom:12}}>
                Detects: Suspicious fast closures · High false positive rates · Off-hours uploads · Excessive status changes · Control decay patterns
              </div>
              <button onClick={runAnomalies} disabled={loading} className="btn btn-primary" style={{fontSize:11}}>
                {loading?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>Scanning...</>:<><Shield size={12}/>Run Anomaly Scan</>}
              </button>
            </div>
          </div>

          {anomalies&&(
            <div className="glass-card anim-fade-in">
              <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:8}}>
                <AlertTriangle size={14} color="#fbbf24"/>
                <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14}}>Anomalies Detected</span>
                <span style={{fontSize:10,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{anomalies.total||0} total</span>
              </div>
              {anomalies.error?(
                <div style={{padding:20,color:'#f87171'}}>{anomalies.error}</div>
              ):anomalies.total===0?(
                <div style={{padding:'40px 0',textAlign:'center',color:'rgba(52,211,153,0.4)'}}>
                  <Shield size={36} style={{margin:'0 auto 12px',display:'block'}}/>
                  <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:16}}>No anomalies detected</div>
                </div>
              ):(
                <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>
                  {anomalies.anomalies?.map((a:any,i:number)=>{
                    const ac=ANOM_COLORS[a.type]||{color:'#94a3b8',bg:'rgba(148,163,184,0.06)'};
                    return (
                      <div key={i} style={{padding:'12px 14px',background:ac.bg,border:`1px solid ${ac.color}25`,borderRadius:9,animation:`fadeUp 0.2s ease ${i*30}ms both`}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:ac.color,flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                              <span style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.08em',color:ac.color,background:ac.bg,border:`1px solid ${ac.color}30`,padding:'1px 7px',borderRadius:3}}>{a.type.replace(/_/g,' ')}</span>
                              <span style={{fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,padding:'1px 6px',borderRadius:3,background:`${SEV_CLR[a.severity]||'#94a3b8'}15`,color:SEV_CLR[a.severity]||'#94a3b8'}}>{a.severity}</span>
                            </div>
                            <div style={{fontSize:12,color:'rgba(148,163,184,0.8)'}}>{a.description}</div>
                            {a.org&&<div style={{fontSize:10,color:'rgba(148,163,184,0.4)',marginTop:2}}>Org: {a.org}</div>}
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
      )}

      {/* ── FORECAST TAB ── */}
      {tab==='forecast'&&(
        <div className="anim-fade-in">
          <div className="glass-card" style={{padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:8}}>
              Rule-based risk forecasting · Works with any amount of data
            </div>
            <div style={{fontSize:12,color:'rgba(148,163,184,0.55)',lineHeight:1.6,marginBottom:12}}>
              Scores each department based on unresolved findings, SLA breaches, recurring failures, and trend direction. Predictive ML model planned for Phase 2 (1M+ findings required).
            </div>
            <button onClick={runForecast} disabled={loading} className="btn btn-primary" style={{fontSize:11}}>
              {loading?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>Computing...</>:<><TrendingUp size={12}/>Generate Forecast</>}
            </button>
          </div>

          {forecast&&(
            <div className="anim-fade-in">
              {forecast.error?(
                <div className="glass-card" style={{padding:20,color:'#f87171'}}>{forecast.error}</div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {forecast.forecasts?.map((f:any,i:number)=>{
                    const tc=TREND_CLR[f.riskTrend]||'#94a3b8';
                    const isOpen=expanded===f.orgId;
                    return (
                      <div key={f.orgId} className="glass-card" style={{overflow:'hidden',animation:`fadeUp 0.25s ease ${i*40}ms both`}}>
                        <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',cursor:'pointer'}} onClick={()=>setExpanded(isOpen?null:f.orgId)}>
                          {/* Risk score */}
                          <div style={{width:52,height:52,borderRadius:12,background:`rgba(${f.riskTrend==='WORSENING'?'239,68,68':f.riskTrend==='IMPROVING'?'52,211,153':'59,130,246'},0.1)`,border:`1px solid ${tc}30`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:20,color:tc,lineHeight:1}}>{f.forecastScore}</span>
                            <span style={{fontSize:8,color:'rgba(148,163,184,0.4)',letterSpacing:'0.06em'}}>RISK</span>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14,color:'rgba(148,163,184,0.9)'}}>{f.orgName}</span>
                              <span style={{fontSize:8,fontFamily:'IBM Plex Mono,monospace',color:'rgba(148,163,184,0.3)'}}>{f.shortCode}</span>
                              <span style={{marginLeft:'auto',fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,padding:'2px 8px',borderRadius:4,background:`${tc}12`,color:tc,border:`1px solid ${tc}25`}}>{f.riskTrend}</span>
                            </div>
                            <div style={{display:'flex',gap:12,fontSize:10,color:'rgba(148,163,184,0.4)'}}>
                              <span>{f.total} open findings</span>
                              {f.criticalCount>0&&<span style={{color:'#f87171'}}>{f.criticalCount} critical</span>}
                              {f.breachedCount>0&&<span style={{color:'#fb923c'}}>{f.breachedCount} SLA breached</span>}
                            </div>
                          </div>
                          {isOpen?<ChevronUp size={14} style={{color:'rgba(148,163,184,0.3)',flexShrink:0}}/>:<ChevronDown size={14} style={{color:'rgba(148,163,184,0.3)',flexShrink:0}}/>}
                        </div>
                        {isOpen&&f.factors?.length>0&&(
                          <div style={{padding:'0 18px 14px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                            <div style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(148,163,184,0.35)',margin:'10px 0 8px'}}>Risk Factors</div>
                            <div style={{display:'flex',flexDirection:'column',gap:5}}>
                              {f.factors.map((factor:string,j:number)=>(
                                <div key={j} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'rgba(148,163,184,0.65)'}}>
                                  <div style={{width:5,height:5,borderRadius:'50%',background:tc,flexShrink:0}}/>
                                  {factor}
                                </div>
                              ))}
                            </div>
                            <a href={`/findings?orgId=${f.orgId}`} className="btn btn-ghost" style={{marginTop:12,textDecoration:'none',display:'inline-flex',fontSize:10}}>View Findings →</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {forecast.note&&(
                    <div style={{padding:'10px 14px',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:8,fontSize:11,color:'rgba(59,130,246,0.55)',lineHeight:1.5}}>
                      ℹ {forecast.note}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
