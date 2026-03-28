'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [partialToken, setPartialToken] = useState('');

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
        localStorage.setItem('ncagp_token', data.accessToken);
        localStorage.setItem('ncagp_user', JSON.stringify(data.user));
        router.push('/dashboard');
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
      localStorage.setItem('ncagp_token', data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', position: 'relative', overflow: 'hidden' }}>

      {/* Left panel — branding */}
      <div style={{ width: '45%', padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,21,39,0.4)', position: 'relative', zIndex: 1 }}>
        <div>
          {/* Emblem */}
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#1a56db,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(26,86,219,0.4)', marginBottom: 28 }}>
            <Shield size={24} color="white" />
          </div>

          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.25em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: 10 }}>
            Government of India
          </div>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 36, color: '#e2e8f0', lineHeight: 1.1, marginBottom: 6 }}>
            National Cyber Audit<br />Governance Platform
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', lineHeight: 1.7, maxWidth: 340, marginTop: 12 }}>
            Sovereign cyber audit intelligence. Real-time risk posture across all ministry departments and critical infrastructure.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'RS256 JWT · MFA enforced',
            'Hash-chained immutable audit ledger',
            'Row-level security per organisation',
            'Data residency: India only (ap-south-1)',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 1, height: 12, background: '#1a56db', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.02em' }}>{f}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 10, color: 'rgba(148,163,184,0.2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            NIC · MEITY · All access monitored
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {!requiresMfa ? (
            <>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 26, color: '#e2e8f0', marginBottom: 6 }}>Secure Sign In</h2>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.04em' }}>Authorised personnel only</p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.3)' }} />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@nic.in"
                      style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 14, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(26,86,219,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.3)' }} />
                    <input
                      type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      style={{ width: '100%', padding: '10px 36px 10px 36px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 14, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(26,86,219,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(148,163,184,0.3)', cursor: 'pointer', padding: 0 }}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: loading ? 'rgba(26,86,219,0.4)' : '#1a56db', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                  {loading ? (
                    <>
                      <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      AUTHENTICATING
                    </>
                  ) : (
                    <>SIGN IN <ArrowRight size={14} /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Shield size={22} color="#34d399" />
                </div>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 22, color: '#e2e8f0', marginBottom: 6 }}>Two-Factor Authentication</h2>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)' }}>Enter the 6-digit code from your authenticator app</p>
              </div>
              <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input
                  type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000" maxLength={6}
                  style={{ textAlign: 'center', padding: '14px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 28, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', outline: 'none' }}
                />
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
                    <AlertCircle size={13} />{error}
                  </div>
                )}
                <button type="submit" disabled={loading || mfaCode.length !== 6}
                  style={{ padding: '11px', background: mfaCode.length === 6 ? '#1a56db' : 'rgba(26,86,219,0.3)', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', cursor: mfaCode.length === 6 ? 'pointer' : 'not-allowed' }}>
                  {loading ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
                </button>
                <button type="button" onClick={() => { setRequiresMfa(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.4)', fontSize: 12, cursor: 'pointer', padding: '6px' }}>
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulseRing { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }`}</style>
    </div>
  );
}
