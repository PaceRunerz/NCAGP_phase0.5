import type { Metadata } from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

// THE NUCLEAR FIX: We force Next.js to only render this widget on the client (browser), skipping the server entirely.
const FeedbackWidget = dynamic(
  () => import('@/components/FeedbackWidget').then((mod) => mod.FeedbackWidget),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'NCAGP — National Cyber Audit Governance Platform',
  description: 'Sovereign cyber audit intelligence — National Informatics Centre, Government of India',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div id="ncagp-app-root">
          {children}
          <FeedbackWidget />
        </div>
      </body>
    </html>
  );
}