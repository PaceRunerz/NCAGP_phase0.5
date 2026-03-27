'use client';

import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, Clock, Activity, TrendingUp,
  ChevronRight, ExternalLink, RefreshCw, Filter,
} from 'lucide-react';

interface DeptRiskData {
  orgId: string;
  orgName: string;
  shortCode: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  openCount: number;
  slaBreachedCount: number;
  riskScore: number;
}

function getRiskTier(score: number) {
  if (score >= 75) return { label: 'CRITICAL', cls: 'critical', scoreColor: '#f87171', bg: 'rgba(127,29,29,0.35)', border: 'rgba(239,68,68,0.35)' };
  if (score >= 50) return { label: 'HIGH',     cls: 'high',     scoreColor: '#fb923c', bg: 'rgba(124,45,18,0.35)', border: 'rgba(249,115,22,0.35)' };
  if (score >= 25) return { label: 'MEDIUM',   cls: 'medium',   scoreColor: '#fbbf24', bg: 'rgba(120,53,15,0.3)',  border: 'rgba(245,158,11,0.3)' };
  if (score > 0)   return { label: 'LOW',      cls: 'low',      scoreColor: '#94a3b8', bg: 'rgba(15,23,42,0.6)',   border: 'rgba(255,255,255,0.08)' };
  return            { label: 'CLEAN',  cls: 'clean',   scoreColor: '#34d399', bg: 'rgba(6,78,59,0.2)',    border: 'rgba(16,185,129,0.2)' };
}

function SeverityBar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0;
  return (
    <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function DeptTile({ dept, maxFindings, onClick }: { dept: DeptRiskData; maxFindings: number; onClick: (d: DeptRiskData) => void }) {
  const tier = getRiskTier(dept.riskScore);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onClick(dept)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: tier.bg,
        border: `1px solid ${hovered ? tier.scoreColor + '60' : tier.border}`,
        borderRadius: 8, padding: '14px 14px 12px', textAlign: 'left', width: '100%',
        cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${tier.scoreColor}20` : 'none',
      }}
    >
      {/* Pulse for critical/high */}
      {(tier.cls === 'critical' || tier.cls === 'high') && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tier.scoreColor, position: 'relative', zIndex: 1 }} />
          <div style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            background: tier.scoreColor + '40',
            animation: 'pulseRing 1.5s ease infinite',
          }} />
        </div>
      )}

      {/* Short code */}
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(148,163,184,0.5)', marginBottom: 2, letterSpacing: '0.08em' }}>
        {dept.shortCode}
      </div>

      {/* Dept name */}
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 10, lineHeight: 1.2,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {dept.orgName}
      </div>

      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 26, color: tier.scoreColor, lineHeight: 1 }}>
          {dept.riskScore.toFixed(0)}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>/100</span>
        <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em',
          color: tier.scoreColor, background: tier.scoreColor + '15', padding: '1px 5px', borderRadius: 3 }}>
          {tier.label}
        </span>
      </div>

      {/* Severity bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
        <SeverityBar count={dept.criticalCount} max={maxFindings} color="#ef4444" />
        <SeverityBar count={dept.highCount} max={maxFindings} color="#f97316" />
        <SeverityBar count={dept.mediumCount} max={maxFindings} color="#f59e0b" />
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
        <span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{dept.openCount}</span> open</span>
        {dept.criticalCount > 0 && (
          <span style={{ color: '#f87171', fontWeight: 600 }}>{dept.criticalCount} P0</span>
        )}
        {dept.slaBreachedCount > 0 && (
          <span style={{ color: '#fb923c', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Clock size={8} />{dept.slaBreachedCount}
          </span>
        )}
      </div>
    </button>
  );
}

export function NationalRiskHeatmap() {
  const [depts, setDepts] = useState<DeptRiskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DeptRiskData | null>(null);
  const [sortBy, setSortBy] = useState<'riskScore' | 'criticalCount' | 'openCount' | 'slaBreachedCount'>('riskScore');
  const [lastUpdated, setLastUpdated] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/findings/risk-heatmap', {
      headers: { Authorization: `Bearer ${localStorage.getItem('ncagp_token')}` },
    })
      .then(r => r.json())
      .then(data => {
        setDepts(Array.isArray(data) ? data : []);
        setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sorted = [...depts].sort((a, b) => b[sortBy] - a[sortBy]);
  const maxFindings = Math.max(...depts.map(d => d.criticalCount + d.highCount), 1);
  const totals = depts.reduce((acc, d) => ({
    critical: acc.critical + d.criticalCount,
    high: acc.high + d.highCount,
    open: acc.open + d.openCount,
    slaBreached: acc.slaBreached + d.slaBreachedCount,
  }), { critical: 0, high: 0, open: 0, slaBreached: 0 });
  const avgRisk = depts.length > 0 ? depts.reduce((s, d) => s + d.riskScore, 0) / depts.length : 0;

  const tierOf = getRiskTier(avgRisk);

  return (
    <div style={{ padding: '24px', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(26,86,219,0.2)', border: '1px solid rgba(26,86,219,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color="#60a5fa" />
            </div>
            <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.03em' }}>
              National Cyber Risk Posture
            </h1>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.04em' }}>
            NIC SOVEREIGN INTELLIGENCE PLATFORM · REAL-TIME
            {lastUpdated && <span style={{ marginLeft: 8, color: 'rgba(148,163,184,0.3)' }}>Updated {lastUpdated}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, color: 'rgba(148,163,184,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Avg Risk Score', value: avgRisk.toFixed(1), sub: `${depts.length} departments`, color: tierOf.scoreColor, icon: <Activity size={14} /> },
          { label: 'Critical Findings', value: totals.critical, sub: 'P0 — Immediate action', color: '#f87171', icon: <AlertTriangle size={14} /> },
          { label: 'Total Open', value: totals.open, sub: `${totals.high} high severity`, color: '#fb923c', icon: <TrendingUp size={14} /> },
          { label: 'SLA Breached', value: totals.slaBreached, sub: 'Overdue remediation', color: '#ef4444', icon: <Clock size={14} /> },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.45)' }}>{label}</div>
              <div style={{ color: color + '70' }}>{icon}</div>
            </div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 32, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)' }}>Sort by</span>
        {([['riskScore','Risk Score'],['criticalCount','Critical'],['openCount','Open'],['slaBreachedCount','SLA Breached']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, letterSpacing: '0.05em',
              background: sortBy === key ? 'rgba(26,86,219,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${sortBy === key ? 'rgba(26,86,219,0.4)' : 'rgba(255,255,255,0.07)'}`,
              color: sortBy === key ? '#93c5fd' : 'rgba(148,163,184,0.5)',
            }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(148,163,184,0.3)' }}>{depts.length} departments indexed</span>
      </div>

      {/* Heatmap grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 150 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(148,163,184,0.3)' }}>
          <Shield size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16 }}>No department data available</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Run the seed script or add organizations</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {sorted.map(dept => (
            <div key={dept.orgId} className="animate-fade-up">
              <DeptTile dept={dept} maxFindings={maxFindings} onClick={setSelected} />
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,13,26,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
          <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, background: 'rgba(6,21,39,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 51, overflow: 'auto', padding: 24 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(26,86,219,0.5), transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(148,163,184,0.4)', marginBottom: 4, letterSpacing: '0.08em' }}>{selected.shortCode}</div>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{selected.orgName}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(148,163,184,0.5)', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>×</button>
            </div>

            {/* Risk score large */}
            {(() => { const t = getRiskTier(selected.riskScore); return (
              <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>COMPOSITE RISK SCORE</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 48, color: t.scoreColor, lineHeight: 1 }}>{selected.riskScore.toFixed(1)}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: t.scoreColor, letterSpacing: '0.1em', marginTop: 4 }}>{t.label} RISK</div>
              </div>
            ); })()}

            {/* Breakdown */}
            <div style={{ background: 'rgba(2,13,26,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Critical', count: selected.criticalCount, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                { label: 'High',     count: selected.highCount,     color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
                { label: 'Medium',   count: selected.mediumCount,   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                { label: 'Low',      count: selected.lowCount,      color: '#94a3b8', bg: 'rgba(148,163,184,0.06)' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: bg }}>
                  <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 20, color }}>{count}</span>
                </div>
              ))}
            </div>

            {/* SLA breach */}
            {selected.slaBreachedCount > 0 && (
              <div style={{ background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', marginBottom: 4 }}>
                  <Clock size={14} />
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>SLA BREACHES</span>
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 36, color: '#f87171' }}>{selected.slaBreachedCount}</div>
                <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.5)', marginTop: 2 }}>findings past remediation deadline</div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`/findings?orgId=${selected.orgId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#1a56db', borderRadius: 6, color: 'white', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '0.05em' }}>
                VIEW ALL FINDINGS <ChevronRight size={14} />
              </a>
              <a href={`/assets?orgId=${selected.orgId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(148,163,184,0.7)', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '0.05em' }}>
                ASSET REGISTER <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
