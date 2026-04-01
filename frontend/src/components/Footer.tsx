'use client';
import { useState, useEffect } from 'react';  fgrd
import { Shield, Lock, Globe, Phone, Mail, ExternalLink, Activity, BookOpen, AlertTriangle, Server } from 'lucide-react';

export function Footer() {
  const [time, setTime] = useState('');
  const [session, setSession] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      setTime(new Date().toLocaleString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }));
      setSession(Math.floor((Date.now()-start)/1000));
    };
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  const fmt = (s:number) => `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <footer className="site-footer">
      <div style={{ padding:'28px 32px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:32, marginBottom:24 }}>

          {/* Brand */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#1a56db,#1345b0)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(26,86,219,0.5)' }}>
                <Shield size={18} color="white"/>
              </div>
              <div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:16, color:'#60a5fa', letterSpacing:'0.05em' }}>NCAGP</div>
                <div style={{ fontSize:8.5, color:'rgba(148,163,184,0.4)', letterSpacing:'0.14em', textTransform:'uppercase' }}>National Cyber Audit Governance Platform</div>
              </div>
            </div>
            <p style={{ fontSize:12, color:'rgba(148,163,184,0.5)', lineHeight:1.7, maxWidth:300, marginBottom:14 }}>
              Sovereign cyber audit intelligence for Government of India. Operated by NIC under Ministry of Electronics & Information Technology.
            </p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['ISO 27001 Ready','SOC2 Design','DPDP Compliant','India Data Residency'].map(b=>(
                <span key={b} style={{ fontSize:9, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.06em', padding:'2px 7px', borderRadius:4, background:'rgba(59,130,246,0.1)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.2)' }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Platform links */}
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(148,163,184,0.35)', marginBottom:12 }}>Platform</div>
            {[
              { label:'Risk Heatmap',   href:'/dashboard', icon:<Activity size={10}/> },
              { label:'Findings',        href:'/findings',  icon:<AlertTriangle size={10}/> },
              { label:'Evidence Portal', href:'/evidence',  icon:<Shield size={10}/> },
              { label:'Audit Ledger',    href:'/ledger',    icon:<BookOpen size={10}/> },
              { label:'Asset Register',  href:'/assets',    icon:<Server size={10}/> },
            ].map(({label,href,icon})=>(
              <a key={href} href={href} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'rgba(148,163,184,0.5)', textDecoration:'none', marginBottom:7, transition:'color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as any).style.color='#60a5fa'}
                onMouseLeave={e=>(e.currentTarget as any).style.color='rgba(148,163,184,0.5)'}>
                <span style={{ color:'rgba(148,163,184,0.3)' }}>{icon}</span>{label}
              </a>
            ))}
          </div>

          {/* Resources */}
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(148,163,184,0.35)', marginBottom:12 }}>Resources</div>
            {[
              { label:'Scanner Integration', href:'/settings' },
              { label:'PDF Reports',          href:'/settings' },
              { label:'Security & MFA',       href:'/settings' },
              { label:'API Keys',             href:'/settings' },
              { label:'NIC Official Site',    href:'https://www.nic.in', ext:true },
              { label:'CERT-In',              href:'https://www.cert-in.org.in', ext:true },
            ].map(({label,href,ext}:any)=>(
              <a key={label} href={href} target={ext?'_blank':undefined} rel={ext?'noopener noreferrer':undefined}
                style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'rgba(148,163,184,0.5)', textDecoration:'none', marginBottom:7, transition:'color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as any).style.color='#60a5fa'}
                onMouseLeave={e=>(e.currentTarget as any).style.color='rgba(148,163,184,0.5)'}>
                {label}{ext&&<ExternalLink size={9} style={{opacity:0.4}}/>}
              </a>
            ))}
          </div>

          {/* Contact + status */}
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(148,163,184,0.35)', marginBottom:12 }}>Contact</div>
            {[
              { icon:<Globe size={10}/>,  text:'www.nic.in' },
              { icon:<Mail size={10}/>,   text:'ncagp-support@nic.in' },
              { icon:<Phone size={10}/>,  text:'1800-111-555 (Toll Free)' },
            ].map(({icon,text})=>(
              <div key={text} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'rgba(148,163,184,0.45)', marginBottom:7 }}>
                <span style={{ color:'rgba(148,163,184,0.25)' }}>{icon}</span>{text}
              </div>
            ))}

            {/* Live status */}
            <div style={{ marginTop:14, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <div className="live-dot"/>
                <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, color:'#34d399', letterSpacing:'0.06em' }}>ALL SYSTEMS OPERATIONAL</span>
              </div>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'rgba(148,163,184,0.4)' }}>Session: {fmt(session)}</div>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'rgba(148,163,184,0.25)', marginTop:2 }}>{time} IST</div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Lock size={9} style={{ color:'rgba(148,163,184,0.2)' }}/>
            <span style={{ fontSize:11, color:'rgba(148,163,184,0.3)' }}>
              © {new Date().getFullYear()} National Informatics Centre, Government of India. All rights reserved.
            </span>
          </div>
          <div style={{ display:'flex', gap:14 }}>
            {['Privacy Policy','Terms of Use','Accessibility','Sitemap'].map(l=>(
              <a key={l} href="#" style={{ fontSize:11, color:'rgba(148,163,184,0.3)', textDecoration:'none', transition:'color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as any).style.color='#60a5fa'}
                onMouseLeave={e=>(e.currentTarget as any).style.color='rgba(148,163,184,0.3)'}>
                {l}
              </a>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Activity size={9} style={{ color:'rgba(148,163,184,0.3)' }}/>
            <span style={{ fontSize:10, color:'rgba(148,163,184,0.25)', fontFamily:'IBM Plex Mono,monospace' }}>API v1.0 · Build 2026.Q1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
