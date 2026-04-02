'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

const ROLE_HOME: Record<string, string> = {
  NIC_ADMIN:     '/dashboard',
  DEPT_CISO:     '/dept-dashboard',
  DEPT_SECURITY: '/dept-dashboard',
  VENDOR_ADMIN:  '/audit-dashboard',
  AUDITOR:       '/audit-dashboard',
  REVIEWER:      '/review-dashboard',
  OBSERVER:      '/review-dashboard',
};

function saveAuth(token: string, user: object) {
  localStorage.setItem('ncagp_token', token);
  localStorage.setItem('ncagp_user', JSON.stringify(user));
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
  document.cookie = `ncagp_token=${token}; expires=${expires}; path=/; SameSite=Strict`;
  document.cookie = `ncagp_user=${encodeURIComponent(JSON.stringify(user))}; expires=${expires}; path=/; SameSite=Strict`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [mfaCode,      setMfaCode]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [requiresMfa,  setRequiresMfa]  = useState(false);
  const [partialToken, setPartialToken] = useState('');
  const [partialUser,  setPartialUser]  = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
      if (data.requiresMfa) {
        setPartialToken(data.accessToken);
        setPartialUser(data.user);
        setRequiresMfa(true);
      } else {
        saveAuth(data.accessToken, data.user);
        router.push(ROLE_HOME[data.user.role] || '/findings');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${partialToken}` },
        body: JSON.stringify({ totpCode: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code — try again');
      saveAuth(data.accessToken, partialUser);
      router.push(ROLE_HOME[partialUser.role] || '/findings');
    } catch (err: any) {
      setError(err.message);
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaInput = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setMfaCode(clean);
    if (clean.length === 6) {
      setTimeout(() => document.getElementById('mfa-submit')?.click(), 100);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#00060f', display:'flex', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, backgroundImage:'radial-gradient(circle,rgba(59,130,246,0.05) 1px,transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }}/>

      {/* Left panel */}
      <div style={{ width:'44%', padding:'48px', display:'flex', flexDirection:'column', justifyContent:'space-between', background:'linear-gradient(160deg,#1a56db,#1040b0)', position:'relative', zIndex:1, overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:40 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={22} color="white"/>
            </div>
            <div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, letterSpacing:'0.2em', color:'rgba(255,255,255,0.65)', textTransform:'uppercase' }}>Government of India</div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:18, color:'white', letterSpacing:'0.06em' }}>NCAGP</div>
            </div>
          </div>
          <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:34, color:'white', lineHeight:1.1, marginBottom:14 }}>National Cyber Audit<br/>Governance Platform</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:1.7, maxWidth:340, marginBottom:32 }}>
            Sovereign cyber audit intelligence for Government of India. Access is restricted to authorised personnel only.
          </p>
          {[
            'RS256 JWT · TOTP MFA enforced',
            'Hash-chained immutable audit ledger',
            'Row-level security per organisation',
            'Data residency: India only',
            'DPDP compliant · ISO 27001 ready',
          ].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,0.5)', flexShrink:0 }}/>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontFamily:'IBM Plex Mono,monospace' }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ position:'relative', zIndex:1, fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          NIC · MEITY · All access monitored and logged
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', position:'relative', zIndex:1 }}>
        <div style={{ width:'100%', maxWidth:380 }}>

          {!requiresMfa ? (
            <>
              <div style={{ marginBottom:32 }}>
                <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:26, color:'#f0f4ff', marginBottom:4 }}>Secure Sign In</h2>
                <p style={{ fontSize:12, color:'rgba(148,163,184,0.45)' }}>Authorised personnel only · All sessions are monitored</p>
              </div>
              <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.45)', marginBottom:7 }}>
                    Official Email Address
                  </div>
                  <div style={{ position:'relative' }}>
                    <Mail size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(148,163,184,0.35)' }}/>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@gov.in"
                      className="gov-input" style={{ paddingLeft:36 }}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize:10, fontFamily:'Rajdhani,sans-serif', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(148,163,184,0.45)', marginBottom:7 }}>
                    Password
                  </div>
                  <div style={{ position:'relative' }}>
                    <Lock size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(148,163,184,0.35)' }}/>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="gov-input" style={{ paddingLeft:36, paddingRight:36 }}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(148,163,184,0.4)', cursor:'pointer', display:'flex' }}>
                      {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, color:'#f87171', fontSize:12 }}>
                    <AlertCircle size={13} style={{ flexShrink:0 }}/>{error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary"
                  style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:4 }}>
                  {loading
                    ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>Authenticating...</>
                    : <>Sign In <ArrowRight size={14}/></>
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ width:56, height:56, borderRadius:14, background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <Shield size={26} color="#34d399"/>
                </div>
                <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:22, color:'#f0f4ff', marginBottom:6 }}>Two-Factor Authentication</h2>
                <p style={{ fontSize:12, color:'rgba(148,163,184,0.5)', lineHeight:1.6 }}>
                  Open Google Authenticator or Authy<br/>and enter the 6-digit code for <strong style={{ color:'rgba(148,163,184,0.7)' }}>NCAGP</strong>
                </p>
              </div>
              <form onSubmit={handleMfa} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={e => handleMfaInput(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  style={{ textAlign:'center', padding:'16px', background:'rgba(1,10,22,0.8)', border:'1.5px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#f0f4ff', fontSize:32, fontFamily:'IBM Plex Mono,monospace', letterSpacing:'0.4em', outline:'none', transition:'border-color 0.15s', width:'100%' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.6)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
                {error && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, color:'#f87171', fontSize:12 }}>
                    <AlertCircle size={13} style={{ flexShrink:0 }}/>{error}
                  </div>
                )}
                <button id="mfa-submit" type="submit" disabled={mfaCode.length !== 6 || loading}
                  className="btn btn-primary"
                  style={{ width:'100%', justifyContent:'center', padding:'12px', opacity: mfaCode.length !== 6 ? 0.45 : 1 }}>
                  {loading
                    ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>Verifying...</>
                    : 'Verify & Continue'
                  }
                </button>
                <button type="button"
                  onClick={() => { setRequiresMfa(false); setMfaCode(''); setError(''); setPartialToken(''); setPartialUser(null); }}
                  style={{ background:'none', border:'none', color:'rgba(148,163,184,0.4)', fontSize:12, cursor:'pointer', padding:6, textAlign:'center' }}>
                  ← Back to login
                </button>
              </form>
              <div style={{ marginTop:18, padding:'12px 14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8, fontSize:11, color:'rgba(245,158,11,0.55)', lineHeight:1.6 }}>
                Code refreshes every 30 seconds. If it fails, wait for the next code. Ensure your phone clock is set to automatic time.
              </div>
            </>
          )}

          <p style={{ textAlign:'center', fontSize:10, color:'rgba(148,163,184,0.18)', marginTop:28, letterSpacing:'0.06em' }}>
            © {new Date().getFullYear()} National Informatics Centre · Ministry of Electronics & IT
          </p>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
