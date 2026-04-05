'use client';
import { useState, useCallback } from 'react';
import { ClipboardList, Plus, CheckCircle2, Clock, AlertTriangle, RefreshCw, X, User, Calendar, ChevronRight } from 'lucide-react';
import { useData, apiFetch } from '@/lib/useData';

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;border:string}> = {
  PENDING:     {label:'Pending',    color:'#fbbf24',bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.25)'},
  IN_PROGRESS: {label:'In Progress',color:'#60a5fa',bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.25)'},
  BLOCKED:     {label:'Blocked',    color:'#f87171',bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.25)'},
  COMPLETED:   {label:'Completed',  color:'#34d399',bg:'rgba(52,211,153,0.1)', border:'rgba(52,211,153,0.25)'},
  CANCELLED:   {label:'Cancelled',  color:'#64748b',bg:'rgba(100,116,139,0.1)',border:'rgba(100,116,139,0.2)'},
};
const SEV_CLR:Record<string,string>={CRITICAL:'#f87171',HIGH:'#fb923c',MEDIUM:'#fbbf24',LOW:'#94a3b8',INFO:'#60a5fa'};

function fmt(d:string){return d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';}
function isOverdue(d:string,status:string){return d&&status!=='COMPLETED'&&status!=='CANCELLED'&&new Date(d)<new Date();}

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  const [filter,   setFilter]   = useState('');
  const [newTask,  setNewTask]  = useState({findingId:'',title:'',description:'',assignedToId:'',dueDate:''});
  const [submitting,setSubmitting]=useState(false);
  const [error,    setError]    = useState('');
  const user = (() => {try{return JSON.parse(localStorage.getItem('ncagp_user')||'{}')}catch{return{}}})();
  const canCreate = ['NIC_ADMIN','DEPT_CISO','DEPT_SECURITY'].includes(user?.role);

  const {data:myTasks, loading:ml, refresh:rm} = useData<any[]>(
    useCallback(()=>apiFetch('/api/tasks/my'),[]),[],{refreshOnFocus:true,refreshOnVisible:true}
  );
  const {data:allTasks, loading:al, refresh:ra} = useData<any[]>(
    useCallback(()=>apiFetch('/api/tasks'),[]),[],{refreshOnFocus:true,refreshOnVisible:true}
  );
  const {data:findingsData} = useData<any>(useCallback(()=>apiFetch('/api/findings?limit=200'),[]),[]);
  const {data:usersData}    = useData<any[]>(useCallback(()=>apiFetch('/api/users').catch(()=>[]),[]),[]);

  const refresh = () => { rm(); ra(); };
  const tasks  = allTasks || [];
  const mine   = myTasks  || [];
  const filtered = filter ? tasks.filter((t:any)=>t.status===filter) : tasks;
  const findings = findingsData?.findings||[];

  const statusCounts = tasks.reduce((acc:any,t:any)=>{acc[t.status]=(acc[t.status]||0)+1;return acc;},{});

  const updateStatus = async (id:string, status:string) => {
    await apiFetch(`/api/tasks/${id}`,{method:'PATCH',body:JSON.stringify({status})});
    refresh();
  };

  const createTask = async () => {
    if(!newTask.findingId||!newTask.title||!newTask.assignedToId||!newTask.dueDate) return;
    setSubmitting(true);setError('');
    try {
      await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify(newTask)});
      setCreating(false);
      setNewTask({findingId:'',title:'',description:'',assignedToId:'',dueDate:''});
      refresh();
    } catch(e:any){setError(e.message);}
    setSubmitting(false);
  };

  return (
    <div style={{padding:24,position:'relative',zIndex:1}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}} className="anim-fade-up">
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:36,height:36,borderRadius:9,background:'rgba(96,165,250,0.12)',border:'1px solid rgba(96,165,250,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ClipboardList size={17} color="#60a5fa"/>
            </div>
            <h1 style={{fontFamily:'Rajdhani,sans-serif',fontSize:22,fontWeight:700}}>Remediation Tasks</h1>
          </div>
          <p style={{fontSize:11,color:'rgba(148,163,184,0.4)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
            Track remediation work per finding · PRD §9 Workflow
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={refresh} className="btn btn-ghost" style={{fontSize:11}}><RefreshCw size={11}/>Refresh</button>
          {canCreate&&<button onClick={()=>setCreating(true)} className="btn btn-primary" style={{fontSize:11}}><Plus size={11}/>New Task</button>}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:20}} className="stagger">
        {Object.entries(STATUS_CONFIG).map(([s,c])=>(
          <div key={s} className="stat-card anim-fade-up" onClick={()=>setFilter(f=>f===s?'':s)} style={{cursor:'pointer',outline:filter===s?`2px solid ${c.color}`:'none'}}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{color:c.color,fontSize:28}}>{statusCounts[s]||0}</div>
          </div>
        ))}
      </div>

      {/* My tasks */}
      {mine.length>0&&(
        <div className="glass-card" style={{padding:20,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <User size={14} color="#a78bfa"/>
            <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14}}>Assigned to Me</span>
            <span style={{marginLeft:'auto',fontSize:9,fontFamily:'Rajdhani,sans-serif',fontWeight:700,padding:'2px 7px',borderRadius:3,background:'rgba(167,139,250,0.15)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.3)'}}>{mine.length}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {mine.slice(0,5).map((t:any)=>{
              const sc=STATUS_CONFIG[t.status]||STATUS_CONFIG.PENDING;
              const overdue=isOverdue(t.dueDate,t.status);
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:`${sc.color}08`,border:`1px solid ${sc.color}25`,borderRadius:9}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:500,color:'rgba(148,163,184,0.9)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                    <div style={{fontSize:10,color:'rgba(148,163,184,0.4)',marginTop:2}}>{t.finding?.title} · Due {fmt(t.dueDate)}{overdue&&<span style={{color:'#f87171'}}> OVERDUE</span>}</div>
                  </div>
                  <select value={t.status} onChange={e=>updateStatus(t.id,e.target.value)}
                    style={{padding:'4px 8px',background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:6,color:sc.color,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,cursor:'pointer',outline:'none'}}>
                    {Object.entries(STATUS_CONFIG).map(([s,c])=><option key={s} value={s}>{c.label}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All tasks table */}
      <div className="glass-card">
        <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <ClipboardList size={14} color="#60a5fa"/>
            <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:14}}>All Tasks</span>
            <span style={{fontSize:10,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{filtered.length}</span>
          </div>
          <div style={{display:'flex',gap:6}}>
            {filter&&<button onClick={()=>setFilter('')} className="btn btn-ghost" style={{padding:'4px 10px',fontSize:10}}><X size:9/>Clear filter</button>}
          </div>
        </div>
        {(al||ml)?(
          <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}>{[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:50}}/>)}</div>
        ):filtered.length===0?(
          <div style={{padding:'60px 0',textAlign:'center',color:'rgba(148,163,184,0.3)'}}>
            <ClipboardList size={36} style={{margin:'0 auto 12px',display:'block',opacity:0.1}}/>
            <div style={{fontFamily:'Rajdhani,sans-serif',fontSize:16,marginBottom:6}}>No tasks yet</div>
            {canCreate&&<button onClick={()=>setCreating(true)} className="btn btn-primary" style={{fontSize:11}}><Plus size={11}/>Create First Task</button>}
          </div>
        ):(
          <table className="gov-table">
            <thead><tr><th>Title</th><th>Finding</th><th>Assigned To</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((t:any,i:number)=>{
                const sc=STATUS_CONFIG[t.status]||STATUS_CONFIG.PENDING;
                const overdue=isOverdue(t.dueDate,t.status);
                return (
                  <tr key={t.id} style={{animation:`fadeUp 0.2s ease ${i*25}ms both`}}>
                    <td><div style={{fontSize:12,color:'rgba(148,163,184,0.85)',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div></td>
                    <td>
                      <div style={{fontSize:11,color:'rgba(148,163,184,0.6)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.finding?.title}</div>
                      {t.finding?.severity&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:`${SEV_CLR[t.finding.severity]}15`,color:SEV_CLR[t.finding.severity],border:`1px solid ${SEV_CLR[t.finding.severity]}25`,fontFamily:'Rajdhani,sans-serif',fontWeight:700}}>{t.finding.severity}</span>}
                    </td>
                    <td><div style={{fontSize:11,color:'rgba(148,163,184,0.7)'}}>{t.assignedTo?.name}</div><div style={{fontSize:9.5,color:'rgba(148,163,184,0.35)',fontFamily:'IBM Plex Mono,monospace'}}>{t.assignedTo?.role}</div></td>
                    <td><span style={{fontSize:11,color:overdue?'#f87171':'rgba(148,163,184,0.5)'}}>{fmt(t.dueDate)}{overdue&&' ⚠'}</span></td>
                    <td>
                      {canCreate?(
                        <select value={t.status} onChange={e=>updateStatus(t.id,e.target.value)}
                          style={{padding:'3px 7px',background:sc.bg,border:`1px solid ${sc.border}`,borderRadius:5,color:sc.color,fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,cursor:'pointer',outline:'none'}}>
                          {Object.entries(STATUS_CONFIG).map(([s,c])=><option key={s} value={s}>{c.label}</option>)}
                        </select>
                      ):<span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontFamily:'Rajdhani,sans-serif',fontWeight:700,background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`}}>{sc.label}</span>}
                    </td>
                    <td><a href={`/findings?id=${t.findingId}`} className="btn btn-ghost" style={{padding:'4px 8px',fontSize:10,textDecoration:'none'}}><ChevronRight size={10}/></a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {creating&&(
        <>
          <div onClick={()=>setCreating(false)} style={{position:'fixed',inset:0,background:'rgba(0,4,12,0.8)',backdropFilter:'blur(8px)',zIndex:1000}}/>
          <div style={{position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',width:'min(440px,calc(100vw-48px))',maxHeight:'calc(100vh-48px)',overflowY:'auto',background:'linear-gradient(160deg,rgba(3,16,36,0.98),rgba(1,10,24,0.99))',border:'1px solid rgba(255,255,255,0.12)',borderRadius:16,padding:22,zIndex:1001,boxShadow:'0 40px 100px rgba(0,0,0,0.8)'}} className="anim-pop-in">
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(96,165,250,0.6),transparent)'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:16,color:'#f0f4ff'}}>Create Remediation Task</div>
              <button onClick={()=>setCreating(false)} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'rgba(148,163,184,0.5)',width:27,height:27,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:13}}>
              {[
                {label:'Finding',el:<select value={newTask.findingId} onChange={e=>setNewTask(p=>({...p,findingId:e.target.value}))} className="gov-input" style={{fontSize:12}}><option value="">Select finding...</option>{findings.filter((f:any)=>!['CLOSED','FALSE_POSITIVE'].includes(f.status)).map((f:any)=><option key={f.id} value={f.id}>[{f.severity}] {f.title}</option>)}</select>},
                {label:'Task Title',el:<input value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} placeholder="What needs to be done?" className="gov-input" style={{fontSize:13}}/>},
                {label:'Assign To',el:<select value={newTask.assignedToId} onChange={e=>setNewTask(p=>({...p,assignedToId:e.target.value}))} className="gov-input" style={{fontSize:12}}><option value="">Select user...</option>{(usersData||[]).map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select>},
                {label:'Due Date',el:<input type="date" value={newTask.dueDate} onChange={e=>setNewTask(p=>({...p,dueDate:e.target.value}))} className="gov-input" style={{fontSize:13}}/>},
              ].map(({label,el})=>(
                <div key={label}>
                  <div style={{fontSize:9.5,fontFamily:'Rajdhani,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(148,163,184,0.4)',marginBottom:6}}>{label}</div>
                  {el}
                </div>
              ))}
              {error&&<div style={{padding:'9px 12px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,color:'#f87171',fontSize:11}}>{error}</div>}
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setCreating(false)} className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}>Cancel</button>
                <button onClick={createTask} disabled={!newTask.findingId||!newTask.title||!newTask.assignedToId||!newTask.dueDate||submitting} className="btn btn-primary" style={{flex:2,justifyContent:'center',opacity:!newTask.findingId||!newTask.title?0.45:1}}>
                  {submitting?'Creating...':'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
