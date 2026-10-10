import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadFolder = 'products' | 'categories' | 'banners' | 'blog';

/** Rasmlar saqlanadigan papka (serverda Docker volume, lokalda ./uploads) */
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}

function supabaseConfigured() {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Fayl saqlash: 'local' (server diski, standart) yoki 'supabase' (ixtiyoriy) */
export function storageDriver(): 'local' | 'supabase' {
  return process.env.STORAGE_DRIVER === 'supabase' && supabaseConfigured() ? 'supabase' : 'local';
}

function checkFile(file: File): string {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error('Faqat JPG, PNG, WEBP yoki AVIF rasm');
  if (file.size > MAX_BYTES) throw new Error('Rasm 5 MB dan katta');
  return ext;
}

/** Rasmni saqlab, ochiq URL qaytaradi (lokal: /uploads/<papka>/<uuid>.<ext>) */
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  const ext = checkFile(file);
  return uploadBuffer(Buffer.from(await file.arrayBuffer()), file.type, folder, ext);
}

/** Tayyor bayt massivini saqlash (Telegram'dan yuklab olingan rasm va h.k.) */
export async function uploadBuffer(body: Buffer, mime: string, folder: UploadFolder, extOverride?: string): Promise<string> {
  const ext = extOverride ?? ALLOWED[mime];
  if (!ext) throw new Error('Faqat JPG, PNG, WEBP yoki AVIF rasm');
  if (body.byteLength > MAX_BYTES) throw new Error('Rasm 5 MB dan katta');
  const name = `${randomUUID()}.${ext}`;

  if (storageDriver() === 'supabase') {
    const base = process.env.SUPABASE_URL!.replace(/\/+$/, '');
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${folder}/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mime,
        'Cache-Control': '31536000',
        'x-upsert': 'false',
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`Yuklashda xato (${res.status})`);
    return `${base}/storage/v1/object/public/${bucket}/${folder}/${name}`;
  }

  const dir = path.join(uploadDir(), folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), body);
  return `/uploads/${folder}/${name}`;
}
