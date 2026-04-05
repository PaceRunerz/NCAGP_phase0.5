'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Shield, AlertTriangle, Clock, Activity, TrendingUp,
  ChevronRight, ExternalLink, RefreshCw, Filter, ArrowUp, port 3030
} from 'lucide-react';

interface DeptRiskData {
  orgId: string; orgName: string; shortCode: string;
  criticalCount: number; highCount: number; mediumCount: number;
  lowCount: number; openCount: number; slaBreachedCount: number;
  riskScore: number;
}

function getRiskTier(score: number) {
  if (score >= 75) return { label: 'CRITICAL', cls: 'critical', color: '#f87171' };
  if (score >= 50) return { label: 'HIGH',     cls: 'high',     color: '#fb923c' };
  if (score >= 25) return { label: 'MEDIUM',   cls: 'medium',   color: '#fbbf24' };
  if (score > 0)   return { label: 'LOW',      cls: 'low',      color: '#94a3b8' };
  return            { label: 'CLEAN',  cls: 'clean',   color: '#34d399' };
}

function AnimatedNumber({ value, color }: { value: number | string; color: string }) {
  const [display, setDisplay] = useState(0);
  const target = typeof value === 'number' ? value : parseFloat(value);

  useEffect(() => {
    let start = 0;
    const steps = 30;
    const increment = target / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(Math.round(start * 10) / 10);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 36, color, lineHeight: 1, letterSpacing: '-0.01em' }}>
      {typeof value === 'string' ? display.toFixed(1) : Math.round(display)}
    </div>
  );
}

function DeptTile({ dept, maxFindings, onClick, delay = 0 }: { dept: DeptRiskData; maxFindings: number; onClick: (d: DeptRiskData) => void; delay?: number }) {
  const tier = getRiskTier(dept.riskScore);
  const [hovered, setHovered] = useState(false);
  const critPct = maxFindings > 0 ? Math.min((dept.criticalCount / maxFindings) * 100, 100) : 0;
  const highPct  = maxFindings > 0 ? Math.min((dept.highCount  / maxFindings) * 100, 100) : 0;
  const medPct   = maxFindings > 0 ? Math.min((dept.mediumCount / maxFindings) * 100, 100) : 0;

  return (
    <button
      onClick={() => onClick(dept)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`risk-tile ${tier.cls}`}
      style={{
        width: '100%', textAlign: 'left',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${tier.color}20` : 'none',
        animationDelay: `${delay}ms`,
        opacity: 0,
        animation: `fadeUp 0.4s ease ${delay}ms forwards`,
      }}
    >
      {/* Pulsing dot for critical/high */}
      {(tier.cls === 'critical' || tier.cls === 'high') && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: tier.color, position: 'relative', zIndex: 1 }} />
          <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: tier.color + '40', animation: 'pulseRing 1.5s ease infinite' }} />
        </div>
      )}

      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(148,163,184,0.45)', marginBottom: 2, letterSpacing: '0.08em' }}>
        {dept.shortCode}
      </div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 13, color: '#f1f5f9', marginBottom: 8, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {dept.orgName}
      </div>

      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 28, color: tier.color, lineHeight: 1 }}>
          {dept.riskScore.toFixed(0)}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>/100</span>
        <span style={{ marginLeft: 4, fontSize: 8, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: tier.color, background: tier.color + '18', padding: '1px 5px', borderRadius: 3, border: `1px solid ${tier.color}30` }}>
          {tier.label}
        </span>
      </div>

      {/* Animated bars */}
      {[
        { pct: critPct, color: '#ef4444' },
        { pct: highPct, color: '#f97316' },
        { pct: medPct,  color: '#f59e0b' },
      ].map((bar, i) => (
        <div key={i} style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', marginBottom: 3 }}>
          <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.color, borderRadius: 1, transition: 'width 0.8s ease', transitionDelay: `${delay + 200 + i * 60}ms` }} />
        </div>
      ))}

      {/* Footer counts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(148,163,184,0.45)', marginTop: 6 }}>
        <span><span style={{ color: '#f1f5f9', fontWeight: 600 }}>{dept.openCount}</span> open</span>
        {dept.criticalCount > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>{dept.criticalCount} P0</span>}
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
    high:     acc.high     + d.highCount,
    open:     acc.open     + d.openCount,
    breached: acc.breached + d.slaBreachedCount,
  }), { critical: 0, high: 0, open: 0, breached: 0 });
  const avgRisk = depts.length > 0 ? depts.reduce((s, d) => s + d.riskScore, 0) / depts.length : 0;
  const tierOf = getRiskTier(avgRisk);

  const KPIs = [
    { label: 'Avg Risk Score',    value: avgRisk.toFixed(1), sub: `${depts.length} departments`, color: tierOf.color,  icon: <Activity size={15} />,       accent: tierOf.color },
    { label: 'Critical Findings', value: totals.critical,    sub: 'P0 — Immediate action',       color: '#f87171',     icon: <AlertTriangle size={15} />,  accent: '#ef4444' },
    { label: 'Total Open',        value: totals.open,        sub: `${totals.high} high severity`, color: '#fb923c',    icon: <TrendingUp size={15} />,     accent: '#f97316' },
    { label: 'SLA Breached',      value: totals.breached,    sub: 'Overdue remediation',          color: '#f87171',    icon: <Clock size={15} />,          accent: '#ef4444' },
  ];

  return (
    <div style={{ padding: 24, minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }} className="animate-fade-up">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(26,86,219,0.2)', border: '1px solid rgba(26,86,219,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'breathe 3s ease-in-out infinite' }}>
              <Shield size={17} color="#60a5fa" />
            </div>
            <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 24, fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.02em' }}>
              National Cyber Risk Posture
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            NIC Sovereign Intelligence · Real-time
            {lastUpdated && <span style={{ marginLeft: 10, color: 'rgba(148,163,184,0.25)' }}>Updated {lastUpdated}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn btn-ghost" style={{ fontSize: 11 }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* KPI cards - FIXED SYNTAX HERE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }} className="stagger-children">
        {KPIs.map(({ label, value, sub, color, icon, accent }, i) => (
          <div key={label} className="stat-card animate-fade-up" style={{ '--accent': accent + '30', animationDelay: `${i * 60}ms` } as any}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="stat-label">{label}</div>
              <div style={{ color: accent + '80' }}>{icon}</div>
            </div>
            <AnimatedNumber value={value} color={color} />
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Sort bar - FIXED MERGED STYLES HERE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, animationDelay: '200ms' } as any} className="animate-fade-up">
        <Filter size={11} style={{ color: 'rgba(148,163,184,0.3)', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.3)' }}>Sort</span>
        {(['riskScore','criticalCount','openCount','slaBreachedCount'] as const).map(key => (
          <button key={key} onClick={() => setSortBy(key)}
            style={{ padding: '4px 11px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.05em',
              background: sortBy === key ? 'rgba(26,86,219,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${sortBy === key ? 'rgba(26,86,219,0.45)' : 'rgba(255,255,255,0.07)'}`,
              color: sortBy === key ? '#93c5fd' : 'rgba(148,163,184,0.45)',
              transition: 'all 0.15s',
            }}>
            {{ riskScore:'Risk Score', criticalCount:'Critical', openCount:'Open', slaBreachedCount:'SLA Breach' }[key]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(148,163,184,0.25)' }}>{depts.length} departments</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 10 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 148, animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(148,163,184,0.2)' }} className="animate-fade-up">
          <Shield size={44} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.15 }} />
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 17 }}>No department data</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Run the seed script to populate data</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 10 }}>
          {sorted.map((dept, i) => (
            <DeptTile key={dept.orgId} dept={dept} maxFindings={maxFindings} onClick={setSelected} delay={i * 50} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${getRiskTier(selected.riskScore).color}60,transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(148,163,184,0.35)', marginBottom: 3 }}>{selected.shortCode}</div>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{selected.orgName}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: 'rgba(148,163,184,0.5)', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}>×</button>
            </div>

            {/* Risk score */}
            {(() => { const t = getRiskTier(selected.riskScore); return (
              <div className={`risk-tile ${t.cls}`} style={{ marginBottom: 14, padding: '18px 20px', cursor: 'default', transform: 'none' }} onClick={() => {}}>
                <div style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>COMPOSITE RISK SCORE</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 52, color: t.color, lineHeight: 1 }}>{selected.riskScore.toFixed(1)}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: t.color, letterSpacing: '0.1em', marginTop: 4 }}>{t.label} RISK TIER</div>
              </div>
            ); })()}

            {/* Breakdown */}
            <div style={{ background: 'rgba(2,13,26,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, overflow: 'hidden', marginBottom: 14 }}>
              {[
                { label: 'Critical', count: selected.criticalCount, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                { label: 'High',     count: selected.highCount,     color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
                { label: 'Medium',   count: selected.mediumCount,   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                { label: 'Low',      count: selected.lowCount,      color: '#94a3b8', bg: 'rgba(148,163,184,0.05)' },
              ].map(({ label, count, color, bg }, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: bg, transition: 'background 0.15s' }}>
                  <span style={{ fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(148,163,184,0.55)' }}>{label.toUpperCase()}</span>
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 22, color }}>{count}</span>
                </div>
              ))}
            </div>

            {/* SLA */}
            {selected.slaBreachedCount > 0 && (
              <div style={{ background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, padding: '14px 16px', marginBottom: 14 }} className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', marginBottom: 4 }}>
                  <Clock size={14} />
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>SLA BREACHES</span>
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 40, color: '#f87171' }}>{selected.slaBreachedCount}</div>
                <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.5)', marginTop: 2 }}>findings past remediation deadline</div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`/findings?orgId=${selected.orgId}`} className="btn btn-primary" style={{ justifyContent: 'center', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif' }}>
                VIEW ALL FINDINGS <ChevronRight size={13} />
              </a>
              <a href={`/assets?orgId=${selected.orgId}`} className="btn btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif' }}>
                ASSET REGISTER <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.4);opacity:0}} @keyframes breathe{0%,100%{box-shadow:0 0 12px rgba(26,86,219,0.3)}50%{box-shadow:0 0 24px rgba(26,86,219,0.6)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
