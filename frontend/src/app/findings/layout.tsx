'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
export default function FindingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => { if (!localStorage.getItem('ncagp_token')) router.replace('/login'); }, [router]);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar /><main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
    </div>
  );
}
