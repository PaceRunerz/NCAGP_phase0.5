'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_HOME: Record<string, string> = {
  NIC_ADMIN:     '/dashboard',        // Global heatmap
  DEPT_CISO:     '/dept-dashboard',   // Dept CISO view
  DEPT_SECURITY: '/dept-dashboard',   // Same dept view
  VENDOR_ADMIN:  '/audit-dashboard',  // Audit/vendor view
  AUDITOR:       '/audit-dashboard',  // Auditor view
  REVIEWER:      '/review-dashboard', // Review view
  OBSERVER:      '/review-dashboard', // Read-only view
};

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('ncagp_token');
    if (!token) { router.replace('/login'); return; }
    try {
      const user = JSON.parse(localStorage.getItem('ncagp_user') || '{}');
      router.replace(ROLE_HOME[user.role] || '/dept-dashboard');
    } catch {
      router.replace('/login');
    }
  }, [router]);
  return (
    <div style={{ minHeight:'100vh', background:'#00060f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
