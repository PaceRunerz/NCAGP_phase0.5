'use client';
import { Sidebar } from '@/components/Sidebar';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EvidencePage() {
  const router = useRouter();
  useEffect(() => {
    if (!localStorage.getItem('ncagp_token')) router.replace('/login');
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <FileText size={18} color="#60a5fa" />
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Evidence Portal</h1>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', marginBottom: 24 }}>
          To upload evidence, open a finding from the <a href="/findings" style={{ color: '#60a5fa', textDecoration: 'none' }}>Findings Registry</a> and click "Upload Evidence".
        </p>
        <div style={{ background: 'rgba(6,21,39,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '40px', textAlign: 'center', color: 'rgba(148,163,184,0.3)' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.15 }} />
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, marginBottom: 8 }}>Select a finding to upload evidence</div>
          <a href="/findings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#1a56db', borderRadius: 6, color: 'white', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', marginTop: 8 }}>
            GO TO FINDINGS →
          </a>
        </div>
      </main>
    </div>
  );
}
