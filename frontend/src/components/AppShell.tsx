'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
 
export default function AppShell({ children }: { children: React.ReactNode }) {         
  const router = useRouter();

  useEffect(() => {
    // Synchronous check — redirect immediately if no token
    if (!localStorage.getItem('ncagp_token')) {
      router.replace('/login');
    }
  }, [router]);

  // Don't show spinner — render immediately
  // If no token the useEffect above redi
  return (
    <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, minHeight:'100vh', overflow:'hidden' }}>
        <main style={{ flex:1, overflow:'auto' }}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
