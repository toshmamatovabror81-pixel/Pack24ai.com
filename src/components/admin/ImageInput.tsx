'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';

/** Rasm: fayl tanlansa Supabase Storage'ga yuklanadi, yoki URL qo'lda kiritiladi */
export function ImageInput({ name, defaultValue, folder }: { name: string; defaultValue?: string | null; folder: 'products' | 'categories' | 'banners' | 'blog' }) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.set('file', file);
    fd.set('folder', folder);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) setUrl(data.url);
      else setError(data.error ?? 'Yuklanmadi');
    } catch {
      setError('Yuklanmadi');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url || '/images/no-image.svg'} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" />
      <div className="flex-1 space-y-2">
        <input name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input" />
        <label className="btn-ghost cursor-pointer px-3 py-1.5 text-sm">
          <Upload className="h-4 w-4" /> {busy ? 'Yuklanmoqda...' : 'Fayldan yuklash'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
        </label>
        {error && <p className="text-xs text-accent-600">{error}</p>}
      </div>
    </div>
  );
}
