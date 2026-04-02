'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Server, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Asset { id: string; name: string; assetType: string; criticality: number; dataSensitivity: string; environment: string; status: string; hostname?: string; _count: { findings: number }; }

const CRIT_COLOR = ['','#4ade80','#34d399','#fbbf24','#fb923c','#f87171'];
const ENV_COLOR: Record<string,string> = { PROD:'#f87171', STAGING:'#fbbf24', DEV:'#60a5fa', DR:'#a78bfa' };

export default function AssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') || '';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) { router.replace('/login'); return; }
    const params = orgId ? `?orgId=${orgId}` : '';
    fetch(`/api/assets${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` } })
      .then(r => r.json()).then(d => { setAssets(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orgId, router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Server size={18} color="#60a5fa" />
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Asset Register</h1>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>
          {assets.length} assets indexed
        </p>

        <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(26,86,219,0.3),transparent)' }} />
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Asset','Type','Criticality','Sensitivity','Environment','Findings'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(148,163,184,0.3)' }}>
                    <Shield size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} />
                    No assets found
                  </td></tr>
                ) : assets.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(26,86,219,0.05)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 13 }}>{a.name}</div>
                      {a.hostname && <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 1 }}>{a.hostname}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(148,163,184,0.4)', fontFamily: 'IBM Plex Mono, monospace' }}>{a.assetType.replace(/_/g,' ')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {[1,2,3,4,5].map(n => (
                          <div key={n} style={{ width: 6, height: 6, borderRadius: 1, background: n <= a.criticality ? CRIT_COLOR[a.criticality] : 'rgba(255,255,255,0.08)' }} />
                        ))}
                        <span style={{ fontSize: 10, color: CRIT_COLOR[a.criticality], marginLeft: 4 }}>{a.criticality}/5</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>{a.dataSensitivity}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, color: ENV_COLOR[a.environment] || '#94a3b8' }}>{a.environment}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: a._count.findings > 0 ? '#f87171' : 'rgba(148,163,184,0.3)' }}>
                        {a._count.findings > 0 ? `⚠ ${a._count.findings}` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
