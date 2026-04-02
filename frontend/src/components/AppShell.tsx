'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ncagp_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  // Don't render anything until we confirm user is logged in
  // This prevents a flash of sidebar before redirect
  if (!ready) {
    return (
      <div style={{ minHeight:'100vh', background:'#00060f', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:28, height:28, border:'2px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    // Full viewport flex row — sidebar on left, content+footer on right
    <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>

      {/* Sidebar — always visible, fixed width, full height */}
      <Sidebar />

      {/* Right side — scrollable content + footer pinned at bottom */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,           // prevent flex overflow
        minHeight: '100vh',
        overflow: 'hidden',
      }}>
        {/* Scrollable main content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>

        {/* Footer always at bottom */}
        <Footer />
      </div>
    </div>
  );
}
