'use client';
import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

const EVENT_COLOR: Record<string,string> = {
  FINDING_CREATED:'#60a5fa', FINDING_STATUS_CHANGED:'#fbbf24',
  EVIDENCE_UPLOADED:'#34d399', EVIDENCE_SUPERSEDED:'#fb923c',
  EVIDENCE_INTEGRITY_CHECK:'#f87171', USER_LOGIN:'#94a3b8',
  USER_LOGOUT:'#64748b', USER_LOCKED:'#ef4444',
  AUDIT_CREATED:'#22d3ee', ORG_CREATED:'#a78bfa',
  VENDOR_BLACKLISTED:'#dc2626',
};

export default function LedgerPage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState('Finding');
  const [entityId, setEntityId] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [chainResult, setChainResult] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) router.replace('/login');
  }, [router]);

  const search = async () => {
    if (!entityId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
      });
      const d = await res.json();
      setEntries(Array.isArray(d) ? d : []);
    } catch { setEntries([]); } finally { setLoading(false); }
  };

  const verifyChain = async () => {
    setChainLoading(true);
    try {
      const res = await fetch('/api/ledger/verify-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
        body: '{}',
      });
      setChainResult(await res.json());
    } catch { } finally { setChainLoading(false); }
  };

  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BookOpen size={18} color="#60a5fa" />
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Immutable Audit Ledger</h1>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>Tamper-evident SHA-256 hash-chained event log</p>

        {/* Chain verification */}
        <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '16px 20px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(26,86,219,0.3),transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: '#e2e8f0', marginBottom: 2 }}>Chain Integrity Verification</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)' }}>Recomputes all SHA-256 hashes and verifies the chain is unbroken</div>
            </div>
            <button onClick={verifyChain} disabled={chainLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#1a56db', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', cursor: chainLoading ? 'not-allowed' : 'pointer', opacity: chainLoading ? 0.6 : 1 }}>
              <ShieldCheck size={13} />{chainLoading ? 'VERIFYING...' : 'VERIFY CHAIN'}
            </button>
          </div>
          {chainResult && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: chainResult.isValid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${chainResult.isValid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 6 }}>
              {chainResult.isValid
                ? <><CheckCircle2 size={14} color="#34d399" /><span style={{ fontSize: 12, color: '#34d399', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>CHAIN INTACT — {chainResult.totalEntries} entries verified</span></>
                : <><AlertTriangle size={14} color="#f87171" /><span style={{ fontSize: 12, color: '#f87171', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>INTEGRITY VIOLATION at {chainResult.brokenAt}</span></>
              }
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select value={entityType} onChange={e => setEntityType(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none', flexShrink: 0 }}>
            {['Finding','Evidence','Audit','User','Organization','Asset'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input value={entityId} onChange={e => setEntityId(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Paste entity UUID here..."
            style={{ flex: 1, padding: '8px 14px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e2e8f0', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', outline: 'none' }}
          />
          <button onClick={search} disabled={loading || !entityId.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a56db', border: 'none', borderRadius: 6, color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', cursor: !entityId.trim() ? 'not-allowed' : 'pointer', opacity: !entityId.trim() ? 0.5 : 1 }}>
            <Search size={12} />{loading ? 'SEARCHING...' : 'SEARCH'}
          </button>
        </div>

        {/* Results */}
        {entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry, i) => (
              <div key={entry.id} className="animate-fade-up" style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,${EVENT_COLOR[entry.eventType] || '#1a56db'}60,transparent)` }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: EVENT_COLOR[entry.eventType] || '#e2e8f0', letterSpacing: '0.04em' }}>
                      {entry.eventType?.replace(/_/g,' ')}
                    </span>
                    {i === 0 && <span style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', padding: '1px 6px', borderRadius: 3, background: 'rgba(26,86,219,0.2)', color: '#93c5fd', border: '1px solid rgba(26,86,219,0.3)' }}>LATEST</span>}
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>{fmt(entry.timestamp)}</span>
                </div>
                {entry.user && (
                  <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>
                    By <span style={{ color: '#e2e8f0' }}>{entry.user.name}</span> · {entry.user.role} · <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{entry.ipAddress}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(148,163,184,0.2)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>prev: {entry.hashPrev?.slice(0,20)}…</span>
                  <span>curr: {entry.hashCurrent?.slice(0,20)}…</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {entityId && !loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(148,163,184,0.3)' }}>
            <BookOpen size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} />
            No ledger entries found for this entity
          </div>
        )}
      </main>
    </div>
  );
}
