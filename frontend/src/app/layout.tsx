import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NCAGP — National Cyber Audit Governance Platform',
  description: 'Sovereign cyber audit intelligence for Government of India — National Informatics Centre',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
