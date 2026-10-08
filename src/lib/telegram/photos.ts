import 'server-only';
import { uploadBuffer } from '@/lib/storage';
import { downloadFile, type TgPhotoSize } from './api';

/**
 * Telegram'dan kelgan rasmni yuklab olib, o'z xotiramizga saqlaydi va ochiq URL qaytaradi.
 * Telegram'ning file URL'i tokenni o'z ichiga oladi — u hech qachon bazaga yozilmaydi.
 */
export async function storeTelegramPhoto(token: string, photos: TgPhotoSize[], folder: 'recycling' | 'drivers' = 'recycling'): Promise<string | null> {
  const best = [...photos].sort((a, b) => (b.file_size ?? b.width * b.height) - (a.file_size ?? a.width * a.height))[0];
  if (!best) return null;
  const file = await downloadFile(token, best.file_id).catch(() => null);
  if (!file) return null;
  const ext = (file.path.split('.').pop() || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  try {
    return await uploadBuffer(file.buffer, mime, folder, ext === 'png' || ext === 'webp' ? ext : 'jpg');
  } catch (e) {
    console.error('[telegram] rasm saqlanmadi', e instanceof Error ? e.message : e);
    return null;
  }
}
