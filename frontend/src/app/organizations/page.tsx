'use client';
import { useEffect, useState } from 'react';
import { Building2, Users, Server, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Org { id: string; name: string; shortCode: string; orgType: string; isActive: boolean; _count: { users: number; assets: number; findings: number }; }

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  NIC:        { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  DEPARTMENT: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  VENDOR:     { color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
};

export default function OrgsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) { router.replace('/login'); return; }
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` } })
      .then(r => r.json()).then(d => { setOrgs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Building2 size={18} color="#60a5fa" />
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Organisations</h1>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>
          {orgs.length} registered entities
        </p>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {orgs.map(org => {
              const t = TYPE_CONFIG[org.orgType] || TYPE_CONFIG.DEPARTMENT;
              return (
                <div key={org.id} style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '16px 18px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,86,219,0.3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
                  onClick={() => router.push(`/findings?orgId=${org.id}`)}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${t.color}40,transparent)` }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(148,163,184,0.35)', marginBottom: 3, letterSpacing: '0.06em' }}>{org.shortCode}</div>
                      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0', lineHeight: 1.2 }}>{org.name}</div>
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 3, background: t.bg, color: t.color, border: `1px solid ${t.color}30`, flexShrink: 0 }}>
                      {org.orgType}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { icon: <Users size={10} />, val: org._count?.users ?? 0, label: 'users' },
                      { icon: <Server size={10} />, val: org._count?.assets ?? 0, label: 'assets' },
                      { icon: <AlertTriangle size={10} />, val: org._count?.findings ?? 0, label: 'findings' },
                    ].map(({ icon, val, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>
                        {icon} <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{val}</span> {label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
