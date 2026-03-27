'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Clock, RefreshCw, ChevronRight, Filter, FileText, X, Shield } from 'lucide-react';

interface Finding {
  id: string; title: string; severity: string; status: string;
  slaDate: string; slaBreached: boolean; isRecurring: boolean; createdAt: string;
  org: { name: string; shortCode: string };
  asset?: { name: string; criticality: number };
  _count: { evidence: number; tasks: number };
}

const SEV: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: 'P0', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  HIGH:     { label: 'P1', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  MEDIUM:   { label: 'P2', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  LOW:      { label: 'P3', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  INFO:     { label: 'I',  color: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)' },
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#f87171', ACKNOWLEDGED: '#fbbf24', IN_REMEDIATION: '#60a5fa',
  REMEDIATED_PENDING_VALIDATION: '#34d399', VALIDATED: '#4ade80',
  CLOSED: '#475569', RISK_ACCEPTED: '#fb923c', FALSE_POSITIVE: '#374151',
};

function SevBadge({ severity }: { severity: string }) {
  const s = SEV[severity] || SEV.INFO;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
      {s.label} · {severity}
    </span>
  );
}

export default function FindingsPage() {
  const searchParams = useSearchParams();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Finding | null>(null);
  const orgId = searchParams.get('orgId') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (orgId) params.set('orgId', orgId);
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      const res = await fetch(`/api/findings?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
      });
      const data = await res.json();
      setFindings(data.findings || []);
      setTotal(data.total || 0);
    } catch { setFindings([]); } finally { setLoading(false); }
  }, [orgId, severity, status]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const selSev = selected ? SEV[selected.severity] || SEV.INFO : null;

  return (
    <div style={{ padding: 24, minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Findings Registry</h1>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {total} total · {orgId ? 'Filtered by org' : 'All organisations'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, color: 'rgba(148,163,184,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <RefreshCw size={11} />Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Filter size={12} style={{ color: 'rgba(148,163,184,0.3)', flexShrink: 0 }} />
        {[
          { value: severity, setter: setSeverity, placeholder: 'All Severities', options: ['CRITICAL','HIGH','MEDIUM','LOW','INFO'] },
        ].map(({ value, setter, placeholder, options }, i) => (
          <select key={i} value={value} onChange={e => setter(e.target.value)}
            style={{ padding: '6px 10px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: value ? '#e2e8f0' : 'rgba(148,163,184,0.4)', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', cursor: 'pointer', outline: 'none' }}>
            <option value="">{placeholder}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding: '6px 10px', background: 'rgba(6,21,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: status ? '#e2e8f0' : 'rgba(148,163,184,0.4)', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', cursor: 'pointer', outline: 'none' }}>
          <option value="">All Statuses</option>
          {['OPEN','ACKNOWLEDGED','IN_REMEDIATION','REMEDIATED_PENDING_VALIDATION','VALIDATED','CLOSED','RISK_ACCEPTED','FALSE_POSITIVE'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(severity || status) && (
          <button onClick={() => { setSeverity(''); setStatus(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            <X size={10} />Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(26,86,219,0.3),transparent)' }} />
        {loading ? (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, paddingRight: 16 }}>
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Severity','Finding','Status','Organisation','SLA Deadline','Evidence'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(148,163,184,0.3)' }}>
                  <Shield size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} />
                  No findings found
                </td></tr>
              ) : findings.map(f => (
                <tr key={f.id} onClick={() => setSelected(f)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(26,86,219,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}><SevBadge severity={f.severity} /></td>
                  <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                    <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                    {f.isRecurring && <span style={{ fontSize: 10, color: '#fb923c', fontFamily: 'IBM Plex Mono, monospace' }}>↻ recurring</span>}
                    {f.asset && <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', marginTop: 1 }}>Asset: {f.asset.name}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, letterSpacing: '0.05em', color: STATUS_COLOR[f.status] || '#94a3b8' }}>
                      {f.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>{f.org?.shortCode}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {f.slaDate ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: f.slaBreached ? '#f87171' : 'rgba(148,163,184,0.4)' }}>
                        {f.slaBreached && <Clock size={10} />}
                        {formatDate(f.slaDate)}
                        {f.slaBreached && <span style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: '#f87171', letterSpacing: '0.08em' }}>BREACHED</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>
                      {f._count.evidence} <span style={{ color: 'rgba(148,163,184,0.2)' }}>files</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,13,26,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
          <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 420, background: 'rgba(6,21,39,0.98)', borderLeft: '1px solid rgba(255,255,255,0.07)', zIndex: 51, overflow: 'auto', padding: 24 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${selSev?.color ?? '#1a56db'}50,transparent)` }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <SevBadge severity={selected.severity} />
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(148,163,184,0.5)', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>×</button>
            </div>

            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, lineHeight: 1.3 }}>{selected.title}</h2>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(148,163,184,0.25)', marginBottom: 20, letterSpacing: '0.06em' }}>{selected.id}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Status', value: selected.status.replace(/_/g,' '), color: STATUS_COLOR[selected.status] },
                { label: 'Organisation', value: selected.org?.shortCode, color: '#e2e8f0' },
                { label: 'SLA Deadline', value: formatDate(selected.slaDate), color: selected.slaBreached ? '#f87171' : '#94a3b8' },
                { label: 'Evidence Files', value: `${selected._count.evidence} uploaded`, color: '#60a5fa' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(2,13,26,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color }}>{value || '—'}</div>
                </div>
              ))}
            </div>

            {selected.slaBreached && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, marginBottom: 16 }}>
                <Clock size={13} color="#f87171" />
                <span style={{ fontSize: 12, color: '#f87171', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 }}>SLA DEADLINE BREACHED</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`/findings/${selected.id}/evidence`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#1a56db', borderRadius: 6, color: 'white', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '0.06em' }}>
                <FileText size={13} />UPLOAD EVIDENCE <ChevronRight size={12} />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
