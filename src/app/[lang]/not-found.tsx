import Link from 'next/link';
import { getDict } from '@/lib/i18n';

// Next not-found sahifasi parametr olmaydi: o'zbekcha matn + barcha tillarga havola
export default function NotFound() {
  const t = getDict('uz');
  return (
    <div className="container-site py-20 text-center">
      <p className="text-6xl font-black text-brand-500">404</p>
      <h1 className="h1 mt-4">{t.common.notFound}</h1>
      <p className="mt-2 text-slate-600">{t.common.notFoundText}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/uz" className="btn-primary">{t.common.toHome}</Link>
        <Link href="/uz/catalog" className="btn-ghost">{t.nav.catalog}</Link>
      </div>
    </div>
  );
}
