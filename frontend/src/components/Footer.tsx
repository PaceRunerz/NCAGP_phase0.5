'use client';

import { Shield, Lock, Globe, Phone, Mail, ExternalLink, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Footer() {
  const [time, setTime] = useState('');
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const tick = () => {
      setTime(new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }));
      setUptime(Math.floor((Date.now() - startTime) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <footer style={{
      background: 'white',
      borderTop: '1px solid #e2e8f0',
      marginTop: 'auto',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* Blue top line */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #1a56db, #3b82f6, #f59e0b)' }} />

      {/* Main footer content */}
      <div style={{ padding: '24px 32px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 24 }}>

          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1a56db,#1345b0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(26,86,219,0.3)' }}>
                <Shield size={17} color="white" />
              </div>
              <div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#1a56db', letterSpacing: '0.05em' }}>NCAGP</div>
                <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>National Cyber Audit Governance Platform</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, maxWidth: 300, marginBottom: 12 }}>
              Sovereign cyber audit intelligence for Government of India. Operated by the National Informatics Centre under Ministry of Electronics & Information Technology.
            </p>
            {/* Security badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ISO 27001 Ready','SOC2 Design','DPDP Compliant','Data Residency: India'].map(badge => (
                <span key={badge} style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.07em', padding: '2px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Platform</div>
            {[
              { label: 'Risk Heatmap',    href: '/dashboard' },
              { label: 'Findings',         href: '/findings' },
              { label: 'Evidence Portal',  href: '/evidence' },
              { label: 'Audit Ledger',     href: '/ledger' },
              { label: 'Asset Register',   href: '/assets' },
              { label: 'Organizations',    href: '/organizations' },
            ].map(({ label, href }) => (
              <a key={href} href={href} style={{ display: 'block', fontSize: 12, color: '#64748b', textDecoration: 'none', marginBottom: 6, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1a56db'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}>
                {label}
              </a>
            ))}
          </div>

          {/* Resources */}
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Resources</div>
            {[
              { label: 'API Documentation',    href: '#' },
              { label: 'Scanner Integration',  href: '/settings' },
              { label: 'PDF Reports',          href: '/settings' },
              { label: 'Security Settings',    href: '/settings' },
              { label: 'NIC Official Site',    href: 'https://www.nic.in', ext: true },
              { label: 'CERT-In',              href: 'https://www.cert-in.org.in', ext: true },
            ].map(({ label, href, ext }) => (
              <a key={href} href={href} target={ext?'_blank':undefined} rel={ext?'noopener noreferrer':undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', textDecoration: 'none', marginBottom: 6, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1a56db'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}>
                {label}
                {ext && <ExternalLink size={9} style={{ opacity: 0.5 }} />}
              </a>
            ))}
          </div>

          {/* Contact & Status */}
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#64748b' }}>
                <Globe size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <span>www.nic.in</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#64748b' }}>
                <Mail size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <span>ncagp-support@nic.in</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#64748b' }}>
                <Phone size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <span>1800-111-555 (Toll Free)</span>
              </div>
            </div>

            {/* Live status widget */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: 'rgba(5,150,105,0.3)', animation: 'pulseRing 1.8s ease infinite' }} />
                </div>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, color: '#059669', letterSpacing: '0.06em' }}>ALL SYSTEMS OPERATIONAL</span>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#64748b' }}>
                Session: {fmtUptime(uptime)}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                {time} IST
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Lock size={10} style={{ color: '#cbd5e1' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              © {new Date().getFullYear()} National Informatics Centre, Government of India. All rights reserved.
            </span>
          </div>
          <div style={{ display: 'flex', align: 'center', gap: 16 }}>
            {['Privacy Policy','Terms of Use','Accessibility','Sitemap'].map(link => (
              <a key={link} href="#" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1a56db'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}>
                {link}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Activity size={10} style={{ color: '#059669' }} />
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
              API v1.0 · Build 2026.Q1
            </span>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.4);opacity:0}}`}</style>
    </footer>
  );
}
