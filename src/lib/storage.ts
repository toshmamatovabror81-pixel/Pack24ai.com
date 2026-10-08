import 'server-only';
import { randomUUID } from 'node:crypto';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 5 * 1024 * 1024;

export function storageConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Rasmni Supabase Storage'ga yuklab, ochiq URL qaytaradi */
export async function uploadImage(file: File, folder: 'products' | 'categories' | 'banners' | 'blog'): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'products';
  if (!base || !key) throw new Error('Supabase Storage sozlanmagan');
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error('Faqat JPG, PNG, WEBP yoki AVIF rasm');
  if (file.size > MAX_BYTES) throw new Error('Rasm 5 MB dan katta');
  const path = `${folder}/${randomUUID()}.${ext}`;
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': file.type, 'Cache-Control': '31536000', 'x-upsert': 'false' },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!res.ok) throw new Error(`Yuklashda xato (${res.status})`);
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
