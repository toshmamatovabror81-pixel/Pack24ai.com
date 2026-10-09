import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { currentDriver } from '@/lib/auth/driver';
import { DriverShell } from '@/components/driver/DriverShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Haydovchi kabineti', template: '%s | Haydovchi kabineti' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#0c1a2e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** /driver uchun alohida html/body (umumiy root layout yo'q). Kirmagan bo'lsa (login/forgot) — qobiqsiz. */
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const driver = await currentDriver();
  return (
    <html lang="uz">
      <body className="bg-slate-100">
        {driver ? <DriverShell name={driver.name} isOnline={driver.isOnline}>{children}</DriverShell> : children}
      </body>
    </html>
  );
}
