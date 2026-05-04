/**
 * Supabase Storage — fayl va URL yuklash yordamchi moduli
 *
 * ENV o'zgaruvchilari (.env):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
 *   SUPABASE_STORAGE_BUCKET=products   (default: "products")
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET       = process.env.SUPABASE_STORAGE_BUCKET ?? 'products';

if (!SUPABASE_URL) {
  console.warn('[supabase-storage] NEXT_PUBLIC_SUPABASE_URL .env da topilmadi!');
}
if (!SERVICE_KEY) {
  console.warn('[supabase-storage] SUPABASE_SERVICE_ROLE_KEY .env da topilmadi!');
}

async function uploadBufferLocally(buffer: Buffer, filename: string): Promise<string> {
  const safeFilename = path.basename(filename);
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeFilename), buffer);
  return `/uploads/${safeFilename}`;
}

/**
 * Buffer ni Supabase Storage ga yuklaydi va public URL qaytaradi.
 * Supabase sozlanmagan yoki hostga ulanib bo'lmasa, dev/admin ishini to'xtatmaslik
 * uchun fayl lokal `public/uploads` papkasiga saqlanadi.
 */
export async function uploadBufferToSupabase(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[supabase-storage] Supabase sozlanmagan, lokal upload ishlatildi.');
    return uploadBufferLocally(buffer, filename);
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`;

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',    // mavjud bo'lsa ustidan yozadi
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Supabase Storage yuklash xatosi: ${res.status} — ${errText}`);
    }

    // Public URL
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'fetch failed') {
      console.warn('[supabase-storage] Supabase hostga ulanib bo\'lmadi, lokal upload ishlatildi.');
      return uploadBufferLocally(buffer, filename);
    }
    throw error;
  }
}
