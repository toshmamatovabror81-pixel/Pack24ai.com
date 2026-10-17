/** FormData'dan uch tilli maydon: name.uz, name.ru, name.en */
export function i18nFrom(fd: FormData, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of ['uz', 'ru', 'en']) {
    const v = String(fd.get(`${name}.${l}`) ?? '').trim();
    if (v) out[l] = v;
  }
  return out;
}

export const text = (fd: FormData, name: string, max = 500) => String(fd.get(name) ?? '').trim().slice(0, max);
export const optText = (fd: FormData, name: string, max = 500) => text(fd, name, max) || null;
export const num = (fd: FormData, name: string) => {
  const raw = String(fd.get(name) ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : null;
};
export const bool = (fd: FormData, name: string) => fd.get(name) === 'on' || fd.get(name) === 'true';
export const date = (fd: FormData, name: string) => {
  const v = text(fd, name, 40);
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
/**
 * <input type="date"> qiymati (YYYY-MM-DD) Toshkent kuni sifatida: kun boshi (00:00) yoki `end` bilan kun oxiri (23:59:59.999),
 * Asia/Tashkent = +05:00 (qishki-yozgi vaqt yo'q). `date()` esa shu satrni UTC yarim tun deb oladi — "31.10 gacha" promokod
 * 31-oktabr soat 05:00 dan rad etilardi.
 */
export const tashkentDay = (fd: FormData, name: string, end = false) => {
  const v = text(fd, name, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}+05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
