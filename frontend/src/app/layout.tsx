import type { Metadata } from 'next';
import './globals.css';
import FeedbackWidgetClient from '@/components/FeedbackWidgetClient';

export const metadata: Metadata = {
  title: 'NCAGP — National Cyber Audit Governance Platform',
  description: 'Sovereign cyber audit intelligence — NIC, Government of India',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (   s
    <html lang="en" data-scroll-behavior="smooth">
      <body suppressHydrationWarning={true}>
        {children}
        <FeedbackWidgetClient />
      </body>
    </html>
  );
}
