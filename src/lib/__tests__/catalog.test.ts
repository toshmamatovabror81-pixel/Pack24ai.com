import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Katalog sahifalash: ?page= manzildan keladi — Infinity, NaN yoki juda katta son bazaga yetmasin (500 o'rniga bo'sh ro'yxat) */
const s = vi.hoisted(() => ({ args: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: async (a: Record<string, unknown>) => { s.args.push(a); return []; },
      count: async () => 0,
    },
  },
}));

const { listProducts, MAX_PAGE } = await import('@/lib/catalog');

beforeEach(() => { s.args.length = 0; });

describe('listProducts sahifa raqami', () => {
  it('yaroqsiz yoki chegaradan tashqari sahifa xavfsiz qiymatga keltiriladi', async () => {
    const cases: [number, number, number][] = [
      // [kelgan sahifa, kutilgan sahifa, kutilgan skip]
      [3, 3, 48],
      [1, 1, 0],
      [0, 1, 0],
      [-5, 1, 0],
      [2.9, 2, 24],
      [Number.POSITIVE_INFINITY, 1, 0],
      [Number.NaN, 1, 0],
      [1e30, MAX_PAGE, (MAX_PAGE - 1) * 24],
      [MAX_PAGE + 1, MAX_PAGE, (MAX_PAGE - 1) * 24],
    ];
    for (const [page, expectedPage, skip] of cases) {
      s.args.length = 0;
      const r = await listProducts({ locale: 'uz', page });
      expect(r.page, `page=${page}`).toBe(expectedPage);
      expect(s.args[0].skip, `page=${page}`).toBe(skip);
      expect(Number.isSafeInteger(s.args[0].skip as number), `page=${page}`).toBe(true);
    }
  });
});
