import 'server-only';
import type { Order, TelegramCustomer } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizeContactPhone, normalizePhone } from '@/lib/format';
import { clip } from './api';

/**
 * Mijoz botidan foydalanuvchilar (TelegramCustomer). Telefon faqat Telegram kontakti orqali tasdiqlanadi
 * (bot `contact.user_id === from.id` ni tekshiradi) — yozib yuborilgan raqam hech qachon qabul qilinmaydi,
 * chunki shu raqam bo'yicha buyurtmalar va qarzdorlik ko'rsatiladi.
 */

export type BotLang = 'uz' | 'ru';
export const isBotLang = (v: unknown): v is BotLang => v === 'uz' || v === 'ru';
export const langOf = (c: Pick<TelegramCustomer, 'lang'> | null | undefined): BotLang => (c && isBotLang(c.lang) ? c.lang : 'uz');

/** Ism 100 belgigacha. Oddiy slice emas: kesish emoji o'rtasidan bo'lsa Prisma rad etadigan yarim surrogat qolardi va mijoz botga kira olmasdi */
const clipName = (s: string | undefined) => clip(s ?? '', 100);
/** Mijoz akkaunti sharti (ko'rish doirasi va xabar oluvchilar uchun bitta): xodim, bloklangan yoki o'chirilgan akkaunt kirmaydi */
const activeCustomer = { role: 'user', isActive: true, deletedAt: null } as const;

/** Kimning ma'lumoti ko'rsatiladi: tasdiqlangan telefon, shu telefonli sayt akkaunti, va havola orqali ulangan buyurtmalar */
export type CustomerScope = { telegramId: string; phone: string | null; userId: number | null };

export const botCustomer = (telegramId: number | string) => prisma.telegramCustomer.findUnique({ where: { telegramId: String(telegramId) } });

/**
 * Bot foydalanuvchisi yozuvi (bo'lmasa yaratadi). Til faqat yangi yozuvda qo'yiladi.
 * upsert ishlatilmaydi: bo'sh `update` bilan Prisma uni SELECT + INSERT qilib bajaradi va yangi foydalanuvchidan bir vaqtda
 * kelgan ikki murojaatning (ikki marta bosish, webhook qayta yuborilishi) biri unique xatosi bilan yiqilardi.
 */
export async function ensureBotCustomer(telegramId: number | string, init: { name?: string; lang?: BotLang } = {}): Promise<TelegramCustomer> {
  const id = String(telegramId);
  const existing = await prisma.telegramCustomer.findUnique({ where: { telegramId: id } });
  if (existing) return existing;
  await prisma.telegramCustomer.createMany({ data: [{ telegramId: id, name: clipName(init.name) || null, lang: init.lang ?? 'uz' }], skipDuplicates: true });
  return prisma.telegramCustomer.findUniqueOrThrow({ where: { telegramId: id } });
}

/**
 * Tasdiqlangan telefonni bog'lash. Raqam boshqa Telegram hisobiga bog'langan bo'lsa (raqam egasi o'zgargan),
 * eski bog'lanish uziladi: oxirgi tasdiqlagan hisob haqiqiy ega hisoblanadi.
 * Raqam faqat to'liq xalqaro ko'rinishda (998 + 9 xona) qabul qilinadi — normalizeContactPhone.
 */
export async function linkCustomerPhone(telegramId: number | string, rawPhone: string, name?: string): Promise<TelegramCustomer | null> {
  const phone = normalizeContactPhone(rawPhone);
  if (!phone) return null;
  const id = String(telegramId);
  const [, row] = await prisma.$transaction([
    prisma.telegramCustomer.updateMany({ where: { phone, telegramId: { not: id } }, data: { phone: null, verifiedAt: null } }),
    prisma.telegramCustomer.upsert({
      where: { telegramId: id },
      create: { telegramId: id, phone, name: clipName(name) || null, verifiedAt: new Date() },
      update: { phone, verifiedAt: new Date(), ...(name ? { name: clipName(name) } : {}) },
    }),
  ]);
  return row;
}

/** Botdan chiqish: telefon bog'lanishi va havola orqali ulangan buyurtmalar uziladi, yozuv o'chiriladi */
export async function unlinkCustomer(telegramId: number | string): Promise<void> {
  const id = String(telegramId);
  await prisma.$transaction([
    prisma.order.updateMany({ where: { telegramUserId: id }, data: { telegramUserId: null } }),
    prisma.telegramCustomer.deleteMany({ where: { telegramId: id } }),
    // Navbatda turgan (hali yuborilmagan) xabarlarida buyurtma ma'lumoti bor — ular ham uziladi
    prisma.botOutbox.deleteMany({ where: { bot: 'customer', chatId: id, sentAt: null, failedAt: null } }),
  ]);
}

export async function setCustomerLang(telegramId: number | string, lang: BotLang): Promise<void> {
  const id = String(telegramId);
  await prisma.telegramCustomer.upsert({ where: { telegramId: id }, create: { telegramId: id, lang }, update: { lang } });
}

export async function setCustomerNotify(telegramId: number | string, notify: boolean): Promise<void> {
  await prisma.telegramCustomer.updateMany({ where: { telegramId: String(telegramId) }, data: { notify } });
}

/** Sayt akkaunti (mijoz roli) telefon bo'yicha; xodim akkauntlari hisobga olinmaydi */
export async function customerScope(c: Pick<TelegramCustomer, 'telegramId' | 'phone'>): Promise<CustomerScope> {
  if (!c.phone) return { telegramId: c.telegramId, phone: null, userId: null };
  const user = await prisma.user.findFirst({ where: { phone: c.phone, ...activeCustomer }, select: { id: true } });
  return { telegramId: c.telegramId, phone: c.phone, userId: user?.id ?? null };
}

/**
 * Buyurtma havolasi (/start <accessToken>) orqali ulash: havolani bilgan odam buyurtma sahifasini baribir ocha oladi,
 * shuning uchun shu bitta buyurtmani chatga bog'lash xavfsiz. Boshqa hisobga ulangan bo'lsa qayta bog'lanmaydi.
 */
export async function bindOrderByToken(telegramId: number | string, token: string): Promise<{ order: Order; bound: boolean } | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const id = String(telegramId);
  const order = await prisma.order.findUnique({ where: { accessToken: token } });
  if (!order || order.deletedAt) return null;
  if (order.telegramUserId === id) return { order, bound: true };
  if (order.telegramUserId) return { order, bound: false };
  const updated = await prisma.order.updateMany({ where: { id: order.id, telegramUserId: null }, data: { telegramUserId: id } });
  return { order: { ...order, telegramUserId: updated.count === 1 ? id : order.telegramUserId }, bound: updated.count === 1 };
}

/**
 * Buyurtma bo'yicha xabar oladigan chatlar: havola orqali ulangan chat va buyurtma telefoni (yoki akkaunt telefoni)
 * tasdiqlangan mijozlar. Xabarnomani o'chirganlar chiqarib tashlanadi. Akkaunt telefoni faqat customerScope bilan bir xil
 * shartda olinadi: bloklangan yoki o'chirilgan akkaunt buyurtmalarini bot ko'rsatmaydi — xabari ham bormaydi.
 */
export async function orderRecipients(order: Pick<Order, 'telegramUserId' | 'contactPhone' | 'userId'>): Promise<{ telegramId: string; lang: BotLang }[]> {
  const phones = new Set<string>();
  if (order.contactPhone) phones.add(order.contactPhone);
  if (order.userId) {
    const u = await prisma.user.findFirst({ where: { id: order.userId, ...activeCustomer }, select: { phone: true } });
    if (u && normalizePhone(u.phone)) phones.add(u.phone);
  }
  const or = [
    ...(order.telegramUserId ? [{ telegramId: order.telegramUserId }] : []),
    ...(phones.size ? [{ phone: { in: [...phones] } }] : []),
  ];
  const rows = or.length ? await prisma.telegramCustomer.findMany({ where: { OR: or } }) : [];
  const out = new Map<string, { telegramId: string; lang: BotLang }>();
  for (const r of rows) if (r.notify) out.set(r.telegramId, { telegramId: r.telegramId, lang: langOf(r) });
  // Havola orqali ulangan, lekin yozuvi yo'q chat (eski sessiya): standart til bilan
  if (order.telegramUserId && !rows.some((r) => r.telegramId === order.telegramUserId)) out.set(order.telegramUserId, { telegramId: order.telegramUserId, lang: 'uz' });
  return [...out.values()];
}
