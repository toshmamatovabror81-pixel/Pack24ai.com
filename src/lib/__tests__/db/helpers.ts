import { randomBytes, randomInt } from 'node:crypto';
import { Prisma, type InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { SiteSettings } from '@/lib/settings';
import type { InlineKeyboard } from '@/lib/telegram/api';

/**
 * Haqiqiy PostgreSQL bilan ishlaydigan testlar uchun umumiy qism. Shartli UPDATE, tranzaksiya va qator qulflari faqat
 * haqiqiy bazada tekshiriladi, shuning uchun baza soxtalashtirilmaydi — faqat Telegram (tarmoq) almashtiriladi.
 * Testlar bazaga yozadi, shuning uchun ikki qavat himoya bor: P24_DB_TESTS=1 bo'lmasa umuman ishga tushmaydi,
 * bo'lsa ham DATABASE_URL faqat shu mashinadagi (yoki CI xizmatidagi) bazani ko'rsatishi shart.
 * Ishga tushirish (migratsiyalari qo'llangan bo'sh bazada; batafsil — docs/DEPLOY-UZCLOUD.md, "Ishlab chiquvchilar uchun: testlar"):
 *   P24_DB_TESTS=1 DATABASE_URL=postgresql://postgres@127.0.0.1:5432/pack24_test npx vitest run src/lib/__tests__/db
 * Poyga testlari (waitForBlocked) bir vaqtda kamida 3 ta ulanish ochadi — manzilga connection_limit=1 yoki 2 qo'shilmasin.
 */

export { prisma };

export const DB_TESTS = process.env.P24_DB_TESTS === '1';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];

/** Ishchi bazaga tasodifan ulanib qolmaslik uchun: manzil mahalliy bo'lmasa xato tashlaydi */
export function assertLocalDatabase(url: string | undefined): void {
  let hosts: string[] = [];
  try {
    const u = new URL(url ?? '');
    // Prisma `?host=` parametrini manzildagi host o'rniga ishlatadi (unix soket papkasi yoki boshqa server); parametr takrorlansa
    // OXIRGISINI oladi (searchParams.get esa birinchisini qaytaradi) — shuning uchun soket bo'lmagan har bir qiymat mahalliy bo'lishi kerak
    const overrides = u.searchParams.getAll('host').filter((h) => !h.startsWith('/'));
    hosts = [u.hostname, ...overrides].map((h) => h.toLowerCase());
  } catch {
    hosts = [];
  }
  if (!hosts.length || !hosts.every((h) => LOCAL_HOSTS.includes(h))) {
    throw new Error(`P24_DB_TESTS=1, lekin DATABASE_URL mahalliy bazani ko'rsatmayapti (host: "${hosts.join(', ') || "yo'q"}"). Bu testlar bazaga yozadi: faqat localhost, 127.0.0.1 yoki "postgres" (CI) qabul qilinadi.`);
  }
}

// Fayl import qilingan zahoti tekshiriladi: xato manzil bilan birorta so'rov ham ketmaydi
if (DB_TESTS) assertLocalDatabase(process.env.DATABASE_URL);

// ─── Telegram o'rniga: yuborilgan xabarlar shu yerga yig'iladi ───────────────

type Sent = { to: string; html: string; inline?: InlineKeyboard };
export const outbox: { customer: Sent[]; staff: Sent[] } = { customer: [], staff: [] };

export function clearOutbox(): void {
  outbox.customer.length = 0;
  outbox.staff.length = 0;
}

/** `vi.mock('@/lib/telegram/notify', ...)` uchun: tarmoqqa chiqmaydi, haqiqiy funksiyalar kabi true/false qaytaradi */
export function notifyMock() {
  const send = (list: Sent[]) => async (to: number | string | null | undefined, html: string, inline?: InlineKeyboard) => {
    if (!to) return false;
    list.push({ to: String(to), html, inline });
    return true;
  };
  return {
    notify: (kind: 'customer' | 'staff', to: number | string | null | undefined, html: string, inline?: InlineKeyboard) => send(outbox[kind])(to, html, inline),
    notifyCustomer: send(outbox.customer),
    notifyStaff: send(outbox.staff),
    // Yo'lda turgan xabarlar hisobi haqiqiy modulda — soxtasida hech narsa yo'lda turmaydi
    staleInFlight: () => undefined,
  };
}

export const TEST_SETTINGS: Pick<SiteSettings, 'companyName' | 'phone'> = { companyName: 'Pack24', phone: '998880557888' };

/** `vi.mock('@/lib/settings', ...)` uchun: haqiqiy getSettings next/cache (unstable_cache) ga tayanadi, u vitest'da ishlamaydi */
export const settingsMock = () => ({ getSettings: async () => TEST_SETTINGS });

// ─── Poyga testlari ──────────────────────────────────────────────────────────

/**
 * Bizning tranzaksiyamiz ushlab turgan qulfni kutayotgan ulanishlar: to'g'ridan-to'g'ri (bizni kutyapti) va navbat orqali
 * (bizni kutayotganni kutyapti, va hokazo). Faqat shu zanjir: boshqa test fayllari parallel ishlab o'z qulflarini ushlab
 * turadi — ularning kutishlari bu yerga kirmaydi.
 * Ro'yxat pg_locks'dan olinadi (kutayotgan ulanishning berilmagan qulf yozuvi bor), pg_stat_activity'dan EMAS: tranzaksiya
 * ichida pg_stat_activity birinchi o'qilgan holatida muzlab qoladi (Postgres hujjati: "Viewing Statistics"), shuning uchun
 * havza (pool) keyin ochgan yangi ulanish unda ko'rinmas va kutayotganlar soni hech qachon yetmas edi — CI'da beqaror test.
 */
const WAITING_ON_US = Prisma.sql`
  WITH RECURSIVE waiting(pid) AS (
    SELECT l.pid FROM pg_locks l WHERE NOT l.granted AND pg_backend_pid() = ANY(pg_blocking_pids(l.pid))
    UNION
    SELECT l.pid FROM pg_locks l JOIN waiting w ON NOT l.granted AND w.pid = ANY(pg_blocking_pids(l.pid))
  )`;

/** Hozir bizning qulfimizni (to'g'ridan-to'g'ri yoki navbat orqali) kutayotgan ulanishlar soni */
export async function blockedCount(tx: Prisma.TransactionClient): Promise<number> {
  const [{ n }] = await tx.$queryRaw<{ n: number }[]>`${WAITING_ON_US} SELECT count(*)::int AS n FROM waiting`;
  return n;
}

/**
 * `tx` tranzaksiyasi ushlab turgan qulfni aynan `count` ta so'rov kutayotganini bazaning o'zidan ko'rguncha kutadi
 * (to'g'ridan-to'g'ri yoki navbat orqali). Shundan keyin tranzaksiya yakunlansa, kutayotganlar birga davom etadi —
 * "ikkalasi ham eski holatni o'qib bo'lgan" vaziyat tasodifga qolmay, har safar bir xil takrorlanadi.
 * Muddat tugasa xatoga shu bazadagi boshqa ulanishlarning holati qo'shiladi — CI'da sababini ko'rish uchun.
 */
export async function waitForBlocked(tx: Prisma.TransactionClient, count: number, timeoutMs = 8000): Promise<void> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const n = await blockedCount(tx);
    if (n === count) return;
    // Ushlab turgan tranzaksiya + kutayotganlar: havzada (pool) shuncha ulanish bo'lmasa kutayotganlar soni hech qachon yetmaydi
    if (Date.now() > until) {
      throw new Error(
        `Qulfni ${count} ta so'rov kutishi kerak edi, hozir ${n} ta (bu testga kamida ${count + 1} ta ulanish kerak — DATABASE_URL da connection_limit kichik emasmi?)${await activitySnapshot(tx)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Shu bazadagi boshqa ulanishlar nima qilayotgani: holati, nimani kutayotgani, kimni kutayotgani va so'rovining boshi */
async function activitySnapshot(tx: Prisma.TransactionClient): Promise<string> {
  try {
    // Tranzaksiya ichida muzlab qolgan ko'rinish emas, hozirgi holat
    await tx.$queryRaw`SELECT pg_stat_clear_snapshot()`;
    const rows = await tx.$queryRaw<{ pid: number; me: number; state: string | null; wait: string | null; blocked_by: string | null; query: string | null }[]>`
      SELECT pid, pg_backend_pid() AS me, state, wait_event_type || ':' || wait_event AS wait,
             array_to_string(pg_blocking_pids(pid), ',') AS blocked_by, left(query, 120) AS query
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'
      ORDER BY pid`;
    const lines = rows.map((r) => `  ${r.pid} ${r.state ?? '-'} ${r.wait ?? 'ishlayapti'} kutyapti:[${r.blocked_by || '-'}] ${(r.query ?? '').replace(/\s+/g, ' ')}`);
    return `\nBazadagi boshqa ulanishlar (biz: ${rows[0]?.me ?? '?'}):\n${lines.join('\n') || '  (yo\'q)'}`;
  } catch (e) {
    return `\n(ulanishlar ro'yxatini olib bo'lmadi: ${e instanceof Error ? e.message : String(e)})`;
  }
}

/**
 * Kutayotganlar qaysi jadval qatorida navbatda turibdi (bazaning o'zidan): `direct` — bizni to'g'ridan-to'g'ri kutyapti,
 * aks holda bizni kutayotgan boshqa so'rovning qulfini. Qator qulfini kutayotgan ulanish o'sha qatorning "tuple" qulfini
 * ushlab turadi — shu yozuvlar olinadi, faqat bizning zanjirimizdagilar (parallel test fayllarining qulflari emas).
 */
export async function blockedRows(tx: Prisma.TransactionClient): Promise<{ table: string; direct: boolean }[]> {
  return tx.$queryRaw<{ table: string; direct: boolean }[]>`${WAITING_ON_US}
    SELECT c.relname AS "table", pg_backend_pid() = ANY(pg_blocking_pids(l.pid)) AS direct
    FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
    WHERE l.locktype = 'tuple' AND l.granted AND l.pid IN (SELECT pid FROM waiting)
    ORDER BY c.relname`;
}

/** Bizning qulfimizni to'g'ridan-to'g'ri kutayotgan so'rovlarni bazaning o'zi bekor qiladi (ular uchun bu oddiy baza xatosi) */
export async function cancelBlockedByUs(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRaw`SELECT pg_cancel_backend(pid) FROM (SELECT DISTINCT l.pid FROM pg_locks l WHERE NOT l.granted AND pg_backend_pid() = ANY(pg_blocking_pids(l.pid))) w`;
}

// ─── Test ma'lumotlari ───────────────────────────────────────────────────────

/**
 * Fayllar parallel ishlaydi va bazada oldingi (uzilib qolgan) ishga tushirishdan qatorlar qolgan bo'lishi mumkin,
 * shuning uchun har bir fayl o'z "bo'lagi"ni oladi: fayl raqami (slot) + tasodifiy 3 xona, bazada band emasligi tekshiriladi.
 */
async function claimTag(slot: number): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const tag = `${slot}${String(randomInt(0, 1000)).padStart(3, '0')}`;
    const phone = { startsWith: `99890${tag}` };
    const tg = { startsWith: `7${tag}` };
    const label = { startsWith: `T${tag}-` };
    const used = await Promise.all([
      prisma.user.count({ where: { OR: [{ phone }, { telegramId: tg }] } }),
      prisma.telegramCustomer.count({ where: { OR: [{ phone }, { telegramId: tg }] } }),
      prisma.order.count({ where: { OR: [{ contactPhone: phone }, { telegramUserId: tg }] } }),
      prisma.contract.count({ where: { OR: [{ phone }, { contractNo: label }] } }),
      prisma.corporateInvoice.count({ where: { invoiceNo: label } }),
      prisma.workOrder.count({ where: { orderNo: label } }),
      prisma.botSession.count({ where: { telegramId: tg } }),
    ]);
    if (used.every((n) => n === 0)) return tag;
  }
  throw new Error(`Test ma'lumotlari uchun bo'sh bo'lak topilmadi (slot ${slot}) — bazada eski test qatorlari juda ko'p`);
}

export type Fixture = Awaited<ReturnType<typeof fixture>>;

/**
 * Bitta test fayli uchun ma'lumot yaratuvchi. `slot` (1–9) har faylda boshqa bo'lishi shart — telefon va Telegram ID lar
 * shunga qarab ajratiladi. Yaratilgan hamma narsa eslab qolinadi va `cleanup()` faqat o'shalarni o'chiradi.
 */
export async function fixture(slot: number) {
  const tag = await claimTag(slot);
  const tgs: string[] = [];
  const ids = { products: [] as number[], orders: [] as number[], users: [] as number[], contracts: [] as number[] };
  let ownWarehouseId: number | null = null;
  let seq = 0;
  const next = (): string => {
    seq += 1;
    if (seq > 999) throw new Error('Bitta test faylida 999 tadan ortiq noyob qiymat so\'raldi');
    return String(seq).padStart(3, '0');
  };

  /** Yangi telefon: 99890 + 7 xona (tasdiqlangan ko'rinishda, 12 xona) */
  const phone = (): string => `99890${tag}${next()}`;

  /** Yangi Telegram ID */
  const tg = (): string => {
    const t = `7${tag}${next()}`;
    tgs.push(t);
    return t;
  };

  async function product(data: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
    const n = next();
    const row = await prisma.product.create({ data: { name: `Test quti ${tag}-${n}`, sku: `T${tag}-${n}`, price: 1000, image: '/test.png', ...data } });
    ids.products.push(row.id);
    return row;
  }

  /** Buyurtma: standart — "Yangi", naqd, 100 000 so'm, saytdagi kabi maxfiy havola kaliti bilan */
  async function order(data: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
    const row = await prisma.order.create({
      data: { status: 'new_', totalAmount: 100000, paymentMethod: 'cash', customerName: `Test mijoz ${tag}`, source: 'web', accessToken: randomBytes(18).toString('base64url'), ...data },
    });
    ids.orders.push(row.id);
    return row;
  }

  async function user(data: Partial<Prisma.UserUncheckedCreateInput> = {}) {
    const row = await prisma.user.create({ data: { name: `Test ${tag}`, passwordHash: '-', ...data, phone: data.phone ?? phone() } });
    ids.users.push(row.id);
    return row;
  }

  /** Mijoz botidan foydalanuvchi; telefon berilsa tasdiqlangan hisoblanadi */
  async function customer(data: Partial<Prisma.TelegramCustomerUncheckedCreateInput> = {}) {
    const telegramId = data.telegramId ?? tg();
    if (!tgs.includes(telegramId)) tgs.push(telegramId);
    return prisma.telegramCustomer.create({ data: { verifiedAt: data.phone ? new Date() : null, ...data, telegramId } });
  }

  async function contract(data: Partial<Prisma.ContractUncheckedCreateInput> = {}) {
    const row = await prisma.contract.create({ data: { contractNo: `T${tag}-SH-${next()}`, companyName: `Test MChJ ${tag}`, ...data } });
    ids.contracts.push(row.id);
    return row;
  }

  /** Hisob-faktura (QQS 12% jami summa ichida); faqat o'zimiz yaratgan buyurtmaga beriladi */
  async function invoice(data: { orderId: number; total: number; dueDate: Date; paid?: number; status?: InvoiceStatus; contractId?: number }) {
    const subtotal = Math.round((data.total / 1.12) * 100) / 100;
    return prisma.corporateInvoice.create({
      data: {
        invoiceNo: `T${tag}-INV-${next()}`, orderId: data.orderId, contractId: data.contractId ?? null,
        subtotal, vatAmount: Math.round((data.total - subtotal) * 100) / 100, totalAmount: data.total,
        paidAmount: data.paid ?? 0, status: data.status ?? 'issued', dueDate: data.dueDate,
      },
    });
  }

  /**
   * Asosiy ombordagi boshlang'ich qoldiq. Omborni inventory.ts ning o'zi tanlaydi (bo'lmasa yaratadi) — test ham aynan
   * o'sha omborga qaraydi. Toza bazada ombor shu yerda paydo bo'lsa, oxirida uni ham o'chiramiz.
   */
  async function stock(productId: number, quantity: number) {
    const existed = await prisma.warehouse.count();
    const { getMainWarehouse } = await import('@/lib/inventory');
    const main = await getMainWarehouse();
    if (existed === 0) ownWarehouseId = main.id;
    await prisma.inventory.create({ data: { productId, warehouseId: main.id, quantity } });
    return main;
  }

  /** Faqat shu fayl yaratgan qatorlar, tashqi kalitlar tartibida (OrderEvent va WorkOrderStage o'zi kaskad bilan ketadi) */
  async function cleanup(): Promise<void> {
    const orderId = { in: ids.orders };
    const productId = { in: ids.products };
    await prisma.corporateInvoice.deleteMany({ where: { orderId } });
    await prisma.workOrder.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.contract.deleteMany({ where: { id: { in: ids.contracts } } });
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.telegramCustomer.deleteMany({ where: { telegramId: { in: tgs } } });
    await prisma.botSession.deleteMany({ where: { telegramId: { in: tgs } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    // Omborni boshqa hech kim ishlatmayotgan bo'lsagina o'chiramiz
    if (ownWarehouseId !== null) await prisma.warehouse.deleteMany({ where: { id: ownWarehouseId, inventory: { none: {} }, movementsFrom: { none: {} }, movementsTo: { none: {} } } });
  }

  return { tag, phone, tg, product, order, user, customer, contract, invoice, stock, cleanup };
}
