'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import {
  Shield, Smartphone, CheckCircle2, AlertTriangle, Key,
  Download, Copy, Trash2, Plus, Eye, EyeOff, RefreshCw,
} from 'lucide-react';

// ── MFA Section ───────────────────────────────────────────────────

function MfaSection() {
  const [status, setStatus] = useState<{ mfaEnabled: boolean } | null>(null);
  const [qrData, setQrData] = useState<{ qrCodeDataUrl: string; manualEntryKey: string; backupCodes: string[] } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [backupSaved, setBackupSaved] = useState(false);

  const token = () => localStorage.getItem('ncagp_token') || '';

  useEffect(() => {
    fetch('/api/auth/mfa/status', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  const startSetup = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setQrData(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const enableMfa = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage(data.message);
      setStatus({ mfaEnabled: true });
      setQrData(null);
      setTotpCode('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const disableMfa = async () => {
    if (!totpCode) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus({ mfaEnabled: false });
      setTotpCode(''); setMessage('MFA disabled.');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ position: 'relative', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(26,86,219,0.4),transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone size={16} color="#60a5fa" />
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Two-Factor Authentication</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>TOTP via Google Authenticator or Authy — no external service required</div>
          </div>
        </div>
        {status && (
          <span style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 4,
            background: status.mfaEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
            color: status.mfaEnabled ? '#34d399' : '#f87171',
            border: `1px solid ${status.mfaEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}` }}>
            {status.mfaEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        )}
      </div>

      <div style={{ padding: 20 }}>
        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, marginBottom: 16 }}>
            <CheckCircle2 size={14} color="#34d399" />
            <span style={{ fontSize: 13, color: '#34d399' }}>{message}</span>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, marginBottom: 16 }}>
            <AlertTriangle size={14} color="#f87171" />
            <span style={{ fontSize: 13, color: '#f87171' }}>{error}</span>
          </div>
        )}

        {!status?.mfaEnabled && !qrData && (
          <div>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
              Protect your account with an authenticator app. Works with Google Authenticator, Authy, Microsoft Authenticator, and any TOTP-compatible app.
            </p>
            <button onClick={startSetup} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#1a56db', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', cursor: 'pointer' }}>
              <Smartphone size={13} />{loading ? 'SETTING UP...' : 'SETUP AUTHENTICATOR'}
            </button>
          </div>
        )}

        {qrData && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginBottom: 8, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 1: Scan QR Code</p>
                <img src={qrData.qrCodeDataUrl} alt="MFA QR Code" style={{ width: 180, height: 180, borderRadius: 8, border: '2px solid rgba(26,86,219,0.3)' }} />
                <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', marginTop: 8 }}>Or enter key manually:</p>
                <code style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'IBM Plex Mono, monospace', wordBreak: 'break-all' }}>{qrData.manualEntryKey}</code>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginBottom: 8, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 2: Save Backup Codes</p>
                <div style={{ background: 'rgba(2,13,26,0.6)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 8, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>⚠ SAVE THESE CODES — SHOWN ONLY ONCE</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {qrData.backupCodes.map((c, i) => (
                      <code key={i} style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'IBM Plex Mono, monospace' }}>{c}</code>
                    ))}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                  <input type="checkbox" checked={backupSaved} onChange={e => setBackupSaved(e.target.checked)} />
                  <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>I have saved my backup codes</span>
                </label>
                <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginBottom: 8, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 3: Verify Code</p>
                <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="Enter 6-digit code"
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 18, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', outline: 'none', marginBottom: 10 }}
                />
                <button onClick={enableMfa} disabled={totpCode.length !== 6 || !backupSaved || loading}
                  style={{ padding: '9px 20px', background: totpCode.length === 6 && backupSaved ? '#059669' : 'rgba(5,150,105,0.3)', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', cursor: totpCode.length === 6 && backupSaved ? 'pointer' : 'not-allowed', width: '100%' }}>
                  {loading ? 'VERIFYING...' : 'ENABLE MFA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {status?.mfaEnabled && !qrData && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 6, marginBottom: 16 }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span style={{ fontSize: 13, color: '#34d399' }}>Your account is protected with two-factor authentication.</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', marginBottom: 12 }}>Enter your current TOTP code to disable MFA:</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000"
                style={{ flex: 1, padding: '8px 12px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 16, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.2em', outline: 'none' }}
              />
              <button onClick={disableMfa} disabled={totpCode.length !== 6 || loading}
                style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, cursor: totpCode.length === 6 ? 'pointer' : 'not-allowed' }}>
                DISABLE MFA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── API Keys Section ───────────────────────────────────────────────

function ApiKeysSection() {
  const [keys, setKeys] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['FINDINGS_WRITE']);
  const [expires, setExpires] = useState('90');
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = () => localStorage.getItem('ncagp_token') || '';

  const loadKeys = () => {
    fetch('/api/api-keys', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setKeys(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => { loadKeys(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name, scopes, expiresInDays: parseInt(expires) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNewKey(data.rawKey);
      setCreating(false);
      setName(''); setScopes(['FINDINGS_WRITE']);
      loadKeys();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    loadKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SCOPE_OPTIONS = [
    { value: 'FINDINGS_WRITE', label: 'Push Findings', desc: 'Nessus, SonarQube, OWASP ZAP' },
    { value: 'FINDINGS_READ', label: 'Read Findings', desc: 'BI tools, dashboards' },
    { value: 'EVIDENCE_WRITE', label: 'Upload Evidence', desc: 'Automated evidence collection' },
    { value: 'FULL_ACCESS', label: 'Full Access', desc: 'Trusted integrations only' },
  ];

  return (
    <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ position: 'relative', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Key size={16} color="#fbbf24" />
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Scanner API Keys</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>Secure tokens for Nessus, SonarQube, OWASP ZAP, and custom integrations</div>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, color: '#fbbf24', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer' }}>
          <Plus size={12} />CREATE KEY
        </button>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div style={{ margin: 16, padding: '16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={14} color="#fbbf24" />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: '#fbbf24', letterSpacing: '0.05em' }}>SAVE THIS KEY NOW — SHOWN ONLY ONCE</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, padding: '8px 12px', background: 'rgba(2,13,26,0.8)', borderRadius: 6, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#34d399', wordBreak: 'break-all', border: '1px solid rgba(16,185,129,0.2)' }}>{newKey}</code>
            <button onClick={() => copyKey(newKey)} style={{ padding: '8px 12px', background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: copied ? '#34d399' : 'rgba(148,163,184,0.5)', cursor: 'pointer', flexShrink: 0 }}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 10, padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(148,163,184,0.4)', fontSize: 11, cursor: 'pointer' }}>
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,13,26,0.4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 5 }}>Key Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nessus Scanner - Production"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 5 }}>Expires (days)</label>
              <select value={expires} onChange={e => setExpires(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none' }}>
                {[30,60,90,180,365].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 8 }}>Scopes</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SCOPE_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: scopes.includes(opt.value) ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${scopes.includes(opt.value) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={scopes.includes(opt.value)} onChange={e => setScopes(e.target.checked ? [...scopes, opt.value] : scopes.filter(s => s !== opt.value))} />
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: '#e2e8f0' }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={loading || !name.trim() || scopes.length === 0}
              style={{ padding: '8px 20px', background: '#1a56db', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', cursor: !name.trim() ? 'not-allowed' : 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
              {loading ? 'GENERATING...' : 'GENERATE KEY'}
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(148,163,184,0.5)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div style={{ padding: keys.length === 0 ? '40px 20px' : 0 }}>
        {keys.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.3)' }}>
            <Key size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.15 }} />
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 14 }}>No API keys yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Create one to connect Nessus, SonarQube, or custom scanners</div>
          </div>
        ) : keys.map((k, i) => (
          <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ display: 'flex', align: 'center', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={12} color="#fbbf24" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{k.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(148,163,184,0.4)' }}>{k.keyPrefix}…</code>
                  {(k.scopes || []).map((s: string) => (
                    <span key={s} style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>{s}</span>
                  ))}
                  {k.lastUsedAt && <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)' }}>Used: {new Date(k.lastUsedAt).toLocaleDateString('en-IN')}</span>}
                  {k.expiresAt && <span style={{ fontSize: 10, color: new Date(k.expiresAt) < new Date() ? '#f87171' : 'rgba(148,163,184,0.3)' }}>Exp: {new Date(k.expiresAt).toLocaleDateString('en-IN')}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => revoke(k.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
              <Trash2 size={11} />Revoke
            </button>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(2,13,26,0.3)' }}>
        <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.3)', marginBottom: 8 }}>How to use with scanners</div>
        <code style={{ display: 'block', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(148,163,184,0.5)', lineHeight: 1.8 }}>
          {`# Add to HTTP header in your scanner config:`}<br/>
          {`X-API-Key: ncagp_sk_your_key_here`}<br/><br/>
          {`# Or via curl:`}<br/>
          {`curl -X POST /api/findings \\`}<br/>
          {`  -H "X-API-Key: ncagp_sk_..." \\`}<br/>
          {`  -d '{"title":"SQL Injection","severity":"CRITICAL",...}'`}
        </code>
      </div>
    </div>
  );
}

// ── PDF Download Section ───────────────────────────────────────────

function PdfSection() {
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('ncagp_token');
      const res = await fetch('/api/reports/national-risk', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NCAGP-Risk-Report-${new Date().toISOString().slice(0,10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ position: 'relative', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.3),transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Download size={16} color="#34d399" />
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Export Risk Report (PDF)</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>Government-grade PDF with risk scores, SLA status, and breach details</div>
          </div>
        </div>
        <button onClick={downloadPdf} disabled={downloading}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, color: '#34d399', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.6 : 1 }}>
          <Download size={13} />{downloading ? 'GENERATING...' : 'DOWNLOAD PDF'}
        </button>
      </div>
      <div style={{ padding: '14px 20px' }}>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', lineHeight: 1.7 }}>
          The report includes: National risk posture summary · Department-wise risk scores · SLA breach detail table · Executive KPIs. Generated in real-time from live data. Classified as <strong style={{ color: '#fbbf24' }}>Official · Sensitive</strong>.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) router.replace('/login');
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Shield size={18} color="#60a5fa" />
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Security Settings</h1>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24 }}>MFA · Alerts · Integrations · Reports</p>

        <PdfSection />
        <MfaSection />
        <ApiKeysSection />
      </main>
    </div>
  );
}
