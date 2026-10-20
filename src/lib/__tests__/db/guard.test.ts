import { describe, expect, it } from 'vitest';
import { assertLocalDatabase } from './helpers';

/**
 * Baza testlarining himoyasi: ishchi baza manzili bilan birorta test ham ishga tushmasligi kerak.
 * Sof tekshiruv (bazaga ulanmaydi), shuning uchun P24_DB_TESTS siz, oddiy `npm test` da ham ishlaydi.
 */
describe('baza testlari himoyasi', () => {
  it('mahalliy baza va CI xizmati qabul qilinadi', () => {
    for (const url of [
      'postgresql://postgres@127.0.0.1:54329/p24vitest',
      'postgresql://postgres:ci@localhost:5432/pack24',
      'postgres://pack24@postgres:5432/pack24?schema=public',
      'postgresql://postgres@LOCALHOST/pack24',
      'postgresql://postgres@localhost/pack24?host=/var/run/postgresql',
      // takrorlangan ?host= — hammasi mahalliy (yoki soket) bo'lsa xavfsiz
      'postgresql://postgres@localhost/pack24?host=localhost&host=127.0.0.1',
      'postgresql://postgres@localhost/pack24?host=/var/run/postgresql&host=LOCALHOST',
    ]) {
      expect(() => assertLocalDatabase(url)).not.toThrow();
    }
  });

  it('boshqa har qanday manzil rad etiladi', () => {
    for (const url of [
      undefined,
      '',
      'bu manzil emas',
      'postgresql:///pack24',
      'postgresql://pack24@db.pack24.uz:5432/pack24',
      'postgresql://pack24@10.0.0.5:5432/pack24',
      'postgresql://pack24@localhost.pack24.uz:5432/pack24',
      'postgresql://pack24@postgres.internal:5432/pack24',
      'postgresql://localhost@db.pack24.uz/localhost',
      'postgresql://pack24@localhost:5432/pack24?host=db.pack24.uz',
      'postgresql://pack24@db.pack24.uz:5432/pack24?host=localhost',
      'postgresql://pack24@db.pack24.uz:5432/pack24?host=/var/run/postgresql',
    ]) {
      expect(() => assertLocalDatabase(url)).toThrow(/DATABASE_URL/);
    }
  });

  it('?host= takrorlansa Prisma OXIRGISIGA ulanadi: birinchisi mahalliy bo\'lgani himoyani aldamaydi', () => {
    for (const url of [
      'postgresql://pack24@localhost:5432/pack24?host=localhost&host=db.pack24.uz',
      'postgresql://pack24@localhost:5432/pack24?host=/var/run/postgresql&host=db.pack24.uz',
      'postgresql://pack24@localhost:5432/pack24?host=&host=db.pack24.uz',
      'postgresql://pack24@127.0.0.1:5432/pack24?schema=public&host=127.0.0.1&connection_limit=5&host=10.0.0.5',
      // tartibi teskari bo'lsa ham (Prisma mahalliyga ulanardi) — manzilda begona server bo'lmasin
      'postgresql://pack24@localhost:5432/pack24?host=db.pack24.uz&host=localhost',
    ]) {
      expect(() => assertLocalDatabase(url)).toThrow(/DATABASE_URL/);
    }
  });
});
