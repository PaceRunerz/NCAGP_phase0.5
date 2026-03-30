'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle, Lock, Mail, ArrowRight, Building2 } from 'lucide-react';
import { saveAuth } from '@/lib/auth';

// Role → home page mapping (PRD §4)
const ROLE_HOME: Record<string, string> = {
  NIC_ADMIN:     '/dashboard',
  DEPT_CISO:     '/findings',
  DEPT_SECURITY: '/findings',
  VENDOR_ADMIN:  '/findings',
  AUDITOR:       '/findings',
  REVIEWER:      '/findings',
  OBSERVER:      '/findings',
};

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]       = useState('');
  const [password,     setPassword]    = useState('');
  const [showPwd,      setShowPwd]     = useState(false);
  const [mfaCode,      setMfaCode]     = useState('');
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState('');
  const [requiresMfa,  setRequiresMfa] = useState(false);
  const [partialToken, setPartialToken]= useState('');

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
      if (!res.ok) throw new Error(data.message || 'Authentication failed');

      if (data.requiresMfa) {
        setPartialToken(data.accessToken);
        setRequiresMfa(true);
      } else {
        // Save to localStorage AND cookie (for middleware)
        saveAuth(data.accessToken, data.user);
        const home = ROLE_HOME[data.user.role] || '/findings';
        router.push(home);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ totpCode: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'MFA verification failed');

      // Need user data — re-fetch or decode from existing partial token
      const userRaw = localStorage.getItem('ncagp_user');
      const user = userRaw ? JSON.parse(userRaw) : { role: 'OBSERVER' };
      saveAuth(data.accessToken, user);
      router.push(ROLE_HOME[user.role] || '/findings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Dot grid bg */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(26,86,219,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />

      {/* Left panel */}
      <div style={{ width: '44%', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg, #1a56db 0%, #1345b0 100%)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {/* White pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
              <Shield size={22} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Government of India</div>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 18, color: 'white', letterSpacing: '0.05em' }}>NCAGP</div>
            </div>
          </div>

          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 34, color: 'white', lineHeight: 1.1, marginBottom: 14 }}>
            National Cyber Audit<br/>Governance Platform
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, maxWidth: 340, marginBottom: 32 }}>
            Sovereign cyber audit intelligence. Real-time risk posture across all ministry departments and critical infrastructure.
          </p>

          {[
            'RS256 JWT · TOTP MFA enforced',
            'Hash-chained immutable audit ledger',
            'Row-level security per organisation',
            'Data residency: India only (ap-south-1)',
            'DPDP compliant · ISO 27001 ready',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.02em' }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          NIC · MEITY · All access monitored and logged
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {!requiresMfa ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 26, color: '#0f172a', marginBottom: 4 }}>Secure Sign In</h2>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Authorised personnel only · All access is monitored</p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>Email Address</div>
                  <div style={{ position: 'relative' }}>
                    <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@nic.in"
                      className="gov-input" style={{ paddingLeft: 36 }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>Password</div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                      className="gov-input" style={{ paddingLeft: 36, paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />{error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 4 }}>
                  {loading ? (
                    <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Authenticating...</>
                  ) : (
                    <>Sign In <ArrowRight size={14} /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Shield size={24} color="#059669" />
                </div>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 22, color: '#0f172a', marginBottom: 4 }}>Two-Factor Authentication</h2>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Enter the 6-digit code from your authenticator app</p>
              </div>
              <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000 000" maxLength={6}
                  style={{ textAlign: 'center', padding: '14px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 28, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', outline: 'none' }}
                  onFocus={e => (e.target.style.borderColor = '#1a56db')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12 }}>
                    <AlertCircle size={13} />{error}
                  </div>
                )}
                <button type="submit" disabled={mfaCode.length !== 6 || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', opacity: mfaCode.length !== 6 ? 0.5 : 1 }}>
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
                <button type="button" onClick={() => { setRequiresMfa(false); setError(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: 6 }}>
                  ← Back to login
                </button>
              </form>
            </>
          )}

          <p style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1', marginTop: 24, letterSpacing: '0.06em' }}>
            © {new Date().getFullYear()} National Informatics Centre · Ministry of Electronics & IT
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
