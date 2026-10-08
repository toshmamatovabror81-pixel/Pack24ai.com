import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = { title: { default: 'Pack24 admin', template: '%s | Pack24 admin' }, robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-slate-100">{children}</body>
    </html>
  );
}
