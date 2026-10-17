import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mahsulot kartasini saqlash va ombor qoldig'i. Qoldiq maydoni sahifa ochilgandagi qiymat bilan to'ldirilgan bo'ladi; karta
 * ochiq turganda qoldiq boshqa joydan o'zgarsa (bot orqali "Yetkazildi" qilingan buyurtma, ombor kirimi), tavsifni tuzatib
 * "Saqlash" bosilganda eski qoldiq qaytib yozilmasligi kerak — maydon faqat xodim o'zi o'zgartirgan bo'lsa yoziladi.
 */
const s = vi.hoisted(() => ({ setStock: [] as unknown[], products: new Map<number, Record<string, unknown>>() }));
class Redirect extends Error {
  constructor(public url: string) { super(`REDIRECT ${url}`); }
}
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
vi.mock('@/lib/auth', () => ({ requireStaff: async () => ({ id: 1, name: 'Admin Ali', role: 'admin' }) }));
vi.mock('@/lib/inventory', () => ({ setStock: async (input: unknown) => { s.setStock.push(input); return { changed: true, quantity: 0 }; } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    category: { findUnique: async () => null },
    product: {
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => { const row = { id: where.id, ...data }; s.products.set(where.id, row); return row; },
      create: async ({ data }: { data: Record<string, unknown> }) => { const row = { id: 77, ...data }; s.products.set(77, row); return row; },
    },
  },
}));

const { saveProduct } = await import('@/app/admin/(panel)/products/actions');
const run = async (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  try {
    await saveProduct(fd);
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  throw new Error('amal yo\'naltirmadi');
};
const base = { id: '9', 'name.uz': 'Quti 30x20', price: '12000' };

beforeEach(() => {
  s.setStock.length = 0;
  s.products.clear();
});

describe('saveProduct: ombor qoldig\'i', () => {
  it('qoldiq maydoni o\'zgartirilmagan bo\'lsa (sahifa ochilgandagi qiymat bilan bir xil) omborga yozilmaydi', async () => {
    expect(await run({ ...base, stock: '50', prevStock: '50', 'description.uz': 'Tuzatilgan tavsif' })).toBe('/admin/products/9?saved=1');
    expect(s.setStock).toEqual([]);
    expect(s.products.get(9)).toMatchObject({ name: 'Quti 30x20', description: 'Tuzatilgan tavsif' });
    // Bo'sh maydon (ombor yozuvi yo'q mahsulot) ham: bo'sh qoldi — yozilmaydi
    expect(await run({ ...base, stock: '', prevStock: '' })).toBe('/admin/products/9?saved=1');
    expect(s.setStock).toEqual([]);
  });

  it('xodim o\'zi o\'zgartirgan qoldiq yoziladi — jurnal sababi "Mahsulot kartasi"', async () => {
    await run({ ...base, stock: '45', prevStock: '50' });
    expect(s.setStock).toEqual([{ productId: 9, quantity: 45, reason: 'Mahsulot kartasi', createdBy: 'Admin Ali' }]);
    // Bo'sh maydonga birinchi marta yozilgan qoldiq; kasr va manfiy qiymat butun va 0 dan kichik bo'lmaydi
    await run({ ...base, stock: '12.7', prevStock: '' });
    await run({ ...base, stock: '-3', prevStock: '5' });
    expect(s.setStock.slice(1)).toEqual([expect.objectContaining({ quantity: 12 }), expect.objectContaining({ quantity: 0 })]);
  });

  it('yangi mahsulot: kiritilgan qoldiq yoziladi; prevStock bo\'lmasa (boshqa chaqiruvchi) avvalgidek har doim yoziladi', async () => {
    expect(await run({ 'name.uz': 'Yangi quti', price: '100', stock: '30', prevStock: '' })).toBe('/admin/products/77?saved=1');
    expect(s.setStock).toEqual([expect.objectContaining({ productId: 77, quantity: 30 })]);
    s.setStock.length = 0;
    await run({ ...base, stock: '50' });
    expect(s.setStock).toEqual([expect.objectContaining({ productId: 9, quantity: 50 })]);
  });
});
