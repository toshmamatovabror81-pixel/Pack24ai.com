import 'server-only';
import type { OrderStatus } from '@prisma/client';
import { can, roleNames } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { displayPhone, formatDate, formatPrice, normalizeContactPhone, normalizePhone } from '@/lib/format';
import { ORDER_STATUSES, orderStatusNames } from '@/lib/orderStatus';
import { siteUrl } from '@/lib/site';
import { clip, esc, keyboard, type InlineKeyboard, type ReplyKeyboard } from '../api';

/**
 * Boshqaruv botining matnlari, tugmalari va kichik qoidalari. Bu yerda baza ham, ctx ham yo'q — shuning uchun
 * hammasi testda tekshiriladi (bot-staff.test.ts). Karta tugmalari (os_ oc_ ocy_ or_ op_) staffCards.ts da; bu yerda:
 *   sl_<ro'yxat>_<sahifa>  ro'yxatning boshqa sahifasi (◀️ ▶️)
 *   sb_<ro'yxat>_<sahifa>  shu sahifani yangilash; kartadagi "Ro'yxatga qaytish" ham aynan shu
 *   sx_y / sx_n            /stop tasdig'i
 * <ro'yxat>: new | active | p<998XXXXXXXXX> (telefon bo'yicha qidiruv natijasi)
 */

export const BTN = {
  newOrders: '🆕 Yangi buyurtmalar',
  active: '⚙️ Jarayonda',
  find: '🔎 Qidirish',
  today: '📊 Bugun',
  debts: '💸 Qarzdorlik',
  notify: '🔔 Xabarnoma',
  help: '❓ Yordam',
  contact: '📱 Telefon raqamni yuborish',
} as const;

const sum = (v: number) => formatPrice(v, "so'm");

// ─── Menyu ───────────────────────────────────────────────────────────────────

/** Doimiy menyu: faqat xodimning roli ruxsat bergan bo'limlar chiqadi (ruxsat har bosishda baribir qayta tekshiriladi) */
export function menuKeyboard(role: Role): ReplyKeyboard {
  const items: string[] = [
    ...(can(role, 'orders') ? [BTN.newOrders, BTN.active, BTN.find, BTN.today] : []),
    ...(can(role, 'finance') ? [BTN.debts] : []),
    BTN.notify,
    BTN.help,
  ];
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return keyboard(rows, { is_persistent: true });
}

export function welcomeHtml(staff: { name: string; role: Role; telegramNotify: boolean }, justLinked: boolean): string {
  return [
    justLinked ? '✅ <b>Bot ulandi!</b>' : null,
    `👋 Assalomu alaykum, <b>${esc(staff.name)}</b>!`,
    `Rol: <b>${roleNames[staff.role]}</b>`,
    '',
    can(staff.role, 'orders')
      ? "Yangi buyurtma va to'lov xabarlari shu chatga keladi. Pastdagi menyudan bo'limni tanlang yoki buyurtma raqamini yozing."
      : "Pastdagi menyudan bo'limni tanlang.",
    staff.telegramNotify ? null : `🔕 Xabarnomalar hozir o'chirilgan — yoqish uchun «${BTN.notify}» ni bosing.`,
    'Yordam: /help',
  ].filter((l) => l !== null).join('\n');
}

export function menuHint(role: Role): string {
  return can(role, 'orders')
    ? "Pastdagi menyudan bo'limni tanlang yoki buyurtma raqamini / mijoz telefonini yozing. Yordam: /help"
    : "Pastdagi menyudan bo'limni tanlang. Yordam: /help";
}

export function helpHtml(role: Role): string {
  const orders = can(role, 'orders');
  return [
    '❓ <b>Boshqaruv boti — yordam</b>',
    '',
    ...(orders
      ? [
          `${BTN.newOrders} — hali qabul qilinmagan buyurtmalar (/new).`,
          `${BTN.active} — tayyorlanayotgan va yo'ldagi buyurtmalar (/active).`,
          `${BTN.find} — buyurtma raqami yoki mijoz telefoni bo'yicha (/find 123, /order 123). Raqamni shunchaki yozib yuborsangiz ham bo'ladi.`,
          `${BTN.today} — bugun tushgan buyurtmalar soni va summasi, ochiq va to'lanmagan buyurtmalar (/today).`,
        ]
      : []),
    ...(can(role, 'finance') ? [`${BTN.debts} — muddati o'tgan hisob-fakturalar (/debts).`] : []),
    `${BTN.notify} — o'zingizga keladigan xabarnomalarni o'chirish yoki yoqish.`,
    '',
    ...(orders
      ? [
          "<b>Buyurtma kartasi.</b> Ro'yxatda buyurtma raqamini bosing. Tugmalar holatni tartib bilan o'zgartiradi: «Qabul qilish» → «Jo'natildi» → «Yetkazildi»; «Bekor qilish» avval tasdiq so'raydi. Har o'zgarishda mijozga avtomatik xabar boradi. «To'landi» naqd yoki bank o'tkazmasi to'lovini belgilaydi — Payme va Click to'lovi o'zi belgilanadi.",
          '',
        ]
      : []),
    '<b>Xabarnomalar.</b>',
    ...(orders ? ["• Yangi buyurtma tushganda va to'lov kelganda — karta tugmalari bilan.", '• Har kuni ertalab — 24 soatdan beri qabul qilinmagan buyurtmalar.'] : []),
    ...(can(role, 'finance') ? ["• Har kuni ertalab — muddati o'tgan hisob-fakturalar."] : []),
    ...(can(role, 'leads') ? ['• Saytdan yangi ariza kelganda.'] : []),
    "Admin panelda rolingiz o'zgarsa yoki akkauntingiz o'chirilsa, bot ham shu zahoti moslashadi.",
    '',
    '/stop — Telegram hisobingizni botdan uzish.',
  ].join('\n');
}

export const notifyHtml = (on: boolean) =>
  on
    ? "🔔 Xabarnomalar <b>yoqildi</b>: yangi buyurtma va to'lov xabarlari shu chatga keladi."
    : `🔕 Xabarnomalar <b>o'chirildi</b>. Menyu va qidiruv ishlayveradi; qayta yoqish uchun yana «${BTN.notify}» ni bosing.`;

export const STOP_ASK = 'Telegram hisobingiz botdan uzilsinmi? Xabarnomalar kelmay qoladi; qayta ulanish uchun /start bosiladi.';
export const stopKeyboard = (): InlineKeyboard => [[{ text: 'Ha, uzilsin', callback_data: 'sx_y' }, { text: "Yo'q", callback_data: 'sx_n' }]];

// ─── Ulanmagan foydalanuvchi ─────────────────────────────────────────────────

export const guestKeyboard = (): ReplyKeyboard => keyboard([[{ text: BTN.contact, request_contact: true }]]);

/** Ulanmagan odamga ko'rinadigan yagona matn: ichki ma'lumot (buyurtma, son, ism) yo'q */
export function guestHtml(): string {
  return [
    '👋 Bu <b>Pack24</b> xodimlari uchun boshqaruv boti.',
    '',
    "Ulanishning ikki yo'li bor:",
    `1️⃣ Pastdagi «${BTN.contact}» tugmasini bosing. Raqamingiz admin paneldagi Xodimlar ro'yxatida bo'lsa, bot darhol ulanadi.`,
    '2️⃣ Administrator bergan 6 xonali bir martalik kodni shu yerga yozing (Admin panel → Xodimlar → «Telegram kodi»).',
    '',
    `🛒 Mijozmisiz? Buyurtma berish va uning holati: ${siteUrl()}`,
  ].join('\n');
}

export const OWN_CONTACT_ONLY = `❌ Faqat o'zingizning raqamingiz qabul qilinadi. Pastdagi «${BTN.contact}» tugmasini bosing — raqamni qo'lda yozish yoki boshqa odamning kontaktini yuborish mumkin emas.`;

export function notInStaffListHtml(rawPhone: string): string {
  // Ulash bilan bir xil qat'iy qoida: 9 xonali xorijiy raqam "+998 ..." ko'rinishida chiqmaydi (bunday raqam tekshirilmagan ham)
  const phone = normalizeContactPhone(rawPhone);
  return [
    `❌ <b>${esc(phone ? displayPhone(phone) : rawPhone)}</b> raqami Xodimlar ro'yxatida topilmadi.`,
    '',
    "Administrator admin panelning «Xodimlar» bo'limida shu raqam bilan xodim qo'shishi yoki sizga 6 xonali bir martalik kod («Telegram kodi») berishi mumkin. Kodni olgach, shu yerga yozing.",
  ].join('\n');
}

/** Ulash kodi — aynan 6 ta raqam (boshqa hech narsa kod sifatida tekshirilmaydi) */
export const isLinkCode = (text: string) => /^\d{6}$/.test(text);

/** '/find 90 123 45 67' -> '90 123 45 67';  '/start@bot 123456' -> '123456' */
export const commandArg = (text: string) => text.replace(/^\/\S+\s*/, '').trim();

// ─── Kodni terib topishdan himoya ────────────────────────────────────────────

export const CODE_MAX_FAILS = 5;
export const CODE_LOCK_MS = 30 * 60_000;
/** Suhbat sessiyasidan alohida qatorda saqlanadi (BotSession.bot = 'staff_code', har bir Telegram foydalanuvchisi uchun alohida) */
export type CodeGuard = { codeFails?: number; codeFailAt?: number };

/** Qulf tugashiga qolgan vaqt (ms); 0 — kod kiritish mumkin */
export function codeLockLeft(s: CodeGuard | null | undefined, now: number): number {
  if ((Number(s?.codeFails) || 0) < CODE_MAX_FAILS) return 0;
  return Math.min(CODE_LOCK_MS, Math.max(0, (Number(s?.codeFailAt) || 0) + CODE_LOCK_MS - now));
}

/** Yana bitta noto'g'ri kod. Oxirgi xatodan 30 daqiqa o'tgan bo'lsa hisob noldan boshlanadi (qulf ham shunda yechiladi). */
export function codeFailed(s: CodeGuard | null | undefined, now: number): Required<CodeGuard> {
  const fresh = now - (Number(s?.codeFailAt) || 0) < CODE_LOCK_MS;
  return { codeFails: (fresh ? Number(s?.codeFails) || 0 : 0) + 1, codeFailAt: now };
}

export const codeWrongHtml = (triesLeft: number) =>
  `❌ Kod noto'g'ri yoki muddati o'tgan (kod 30 daqiqa amal qiladi va faqat bir marta ishlaydi).\nYana <b>${triesLeft}</b> ta urinish qoldi.`;

export const codeLockedHtml = (leftMs: number) =>
  `⛔ Juda ko'p noto'g'ri kod kiritildi. Kod orqali ulanish vaqtincha to'xtatildi — <b>${Math.max(1, Math.ceil(leftMs / 60_000))} daqiqadan</b> keyin qayta urinib ko'ring.\nTelefon raqam orqali ulanish ishlayveradi: pastdagi tugmani bosing.`;

// ─── Qidiruv ─────────────────────────────────────────────────────────────────

export type FindQuery = { kind: 'order'; id: number } | { kind: 'phone'; phone: string } | { kind: 'none' };

/**
 * Qidiruv matni nima: 1–7 xonali son — buyurtma raqami ("#123" ham), telefon ko'rinishidagi yozuv — mijoz telefoni.
 * Telefon faqat raqam va + - ( ) bo'sh joydan iborat bo'lsa qabul qilinadi: ichida raqami bor oddiy gap telefon emas.
 */
export function classifyFind(input: string): FindQuery {
  const t = input.trim();
  const order = /^[#№]?\s*(\d{1,7})$/.exec(t);
  if (order) return Number(order[1]) > 0 ? { kind: 'order', id: Number(order[1]) } : { kind: 'none' };
  const phone = /^[\d\s()+-]{9,24}$/.test(t) ? normalizePhone(t) : null;
  return phone ? { kind: 'phone', phone } : { kind: 'none' };
}

export const FIND_PROMPT = '🔎 Buyurtma raqamini (masalan: 123) yoki mijoz telefonini (masalan: 90 123 45 67) yozing.';
export const FIND_HINT = "🤔 Tushunmadim. Buyurtma raqami — 1–7 xonali son (123), telefon — 9 xonali (90 123 45 67) yoki +998 bilan. Qaytadan yozing.";
export const ORDER_HINT = 'Buyurtma raqamini yozing, masalan: /order 123';

// ─── Ro'yxatlar ──────────────────────────────────────────────────────────────

export type ListKind = { key: 'new' } | { key: 'active' } | { key: 'phone'; phone: string };

/** Telefon bo'yicha qidiruvda oxirgi 5 ta, qolgan ro'yxatlarda sahifasiga 10 ta buyurtma */
export const listPageSize = (kind: ListKind) => (kind.key === 'phone' ? 5 : 10);

const listCode = (kind: ListKind) => (kind.key === 'phone' ? `p${kind.phone}` : kind.key);

/** 'sl_new_2' / 'sb_p998901234567_0' -> ro'yxat va sahifa (0 dan); tanilmasa null */
export function parseListData(data: string): { kind: ListKind; page: number } | null {
  const m = /^s[lb]_(new|active|p(\d{12}))_(\d{1,4})$/.exec(data);
  if (!m) return null;
  const kind: ListKind = m[2] ? { key: 'phone', phone: m[2] } : { key: m[1] === 'new' ? 'new' : 'active' };
  return { kind, page: Number(m[3]) };
}

/** `lines` — tayyor satrlar (staffOrderLine); bo'sh ro'yxatda sarlavha o'rniga "yo'q" degan gap chiqadi */
export function listHtml(kind: ListKind, lines: string[], total: number, page: number, pages: number): string {
  if (!total) {
    if (kind.key === 'phone') return `🔎 <b>${esc(displayPhone(kind.phone))}</b> raqami bo'yicha buyurtma topilmadi.`;
    return kind.key === 'new' ? "🆕 Yangi buyurtma yo'q — hammasi qabul qilingan." : "⚙️ Jarayonda buyurtma yo'q.";
  }
  const title = kind.key === 'phone' ? `🔎 <b>${esc(displayPhone(kind.phone))}</b> — buyurtmalar` : kind.key === 'new' ? '🆕 <b>Yangi buyurtmalar</b>' : '⚙️ <b>Jarayondagi buyurtmalar</b>';
  return [`${title}: <b>${total} ta</b>${pages > 1 ? ` · ${page + 1}/${pages}-sahifa` : ''}`, '', ...lines, '', 'Kartani ochish uchun raqamini bosing.'].join('\n');
}

/** "#id" tugmalari (5 tadan) va sahifalash qatori; o'rtadagi tugma (sb_) shu sahifani yangilaydi */
export function listKeyboard(kind: ListKind, ids: number[], page: number, pages: number): InlineKeyboard {
  const code = listCode(kind);
  const rows: InlineKeyboard = [];
  for (let i = 0; i < ids.length; i += 5) rows.push(ids.slice(i, i + 5).map((id) => ({ text: `#${id}`, callback_data: `or_${id}` })));
  rows.push([
    ...(page > 0 ? [{ text: '◀️', callback_data: `sl_${code}_${page - 1}` }] : []),
    { text: pages > 1 ? `🔄 ${page + 1}/${pages}` : '🔄 Yangilash', callback_data: `sb_${code}_${page}` },
    ...(page < pages - 1 ? [{ text: '▶️', callback_data: `sl_${code}_${page + 1}` }] : []),
  ]);
  return rows;
}

/**
 * Karta ro'yxat xabari o'rnida ochiladi, shuning uchun qaytish yo'li kerak: tugma bosilgan xabarda sb_ tugmasi
 * bo'lsa (ro'yxat yoki undan ochilgan karta), o'sha ro'yxatga qaytaradigan qator. Xabarnoma kartasida bunday tugma yo'q.
 */
export function backRow(source: InlineKeyboard | undefined): InlineKeyboard {
  const data = source?.flat().find((b) => b.callback_data?.startsWith('sb_'))?.callback_data;
  return data && parseListData(data) ? [[{ text: "⬅️ Ro'yxatga qaytish", callback_data: data }]] : [];
}

// ─── Buyurtma kartasi ────────────────────────────────────────────────────────

/** 'os_12_processing' -> { id: 12, status: 'processing' }; noma'lum holat yoki yaroqsiz raqam — null */
export function parseStatusData(data: string): { id: number; status: OrderStatus } | null {
  const m = /^os_(\d{1,10})_([a-z_]+)$/.exec(data);
  if (!m) return null;
  const id = Number(m[1]);
  const status = ORDER_STATUSES.find((s) => s === m[2]);
  return status && id > 0 && id < 2147483647 ? { id, status } : null;
}

/** Karta tepasidagi satr: amal bajarilgani va uni kim bajargani */
export const statusNote = (status: OrderStatus, by: string) => `${status === 'cancelled' ? '❌' : '✅'} <b>Holat: ${orderStatusNames[status]}</b> — ${esc(by)}`;
export const paidNote = (by: string) => `💵 <b>To'lov belgilandi</b> — ${esc(by)}`;
/** "To'landi" tasdig'i: mijozga xabar ketishi va (bo'lsa) hisob-faktura yopilishi oldindan aytiladi */
export const payAskHtml = (id: number, invoiceNo?: string | null) =>
  `❓ <b>Buyurtma #${id} uchun to'lov to'liq qabul qilindimi?</b>
Mijozga «to'lov qabul qilindi» xabari boradi${invoiceNo ? ` va hisob-faktura ${esc(invoiceNo)} to'langan deb yopiladi` : ''}. Buni botdan ortga qaytarib bo'lmaydi.`;
export const cancelAskHtml = (id: number) => `❓ <b>Buyurtma #${id} bekor qilinsinmi?</b>\nMijozga bekor qilingani haqida xabar boradi.`;
export const orderGoneHtml = (id: number) => `🤷 Buyurtma <b>#${id}</b> topilmadi (o'chirilgan bo'lishi mumkin).`;

// ─── Bugun va qarzdorlik ─────────────────────────────────────────────────────

export type TodayStats = {
  /** Toshkent sanasi, YYYY-MM-DD */
  day: string;
  created: number;
  createdSum: number;
  open: { new_: number; processing: number; shipping: number };
  unpaid: number;
  /** null — xodimda moliya ruxsati yo'q, satr umuman chiqmaydi */
  overdue: { count: number; remaining: number } | null;
};

export function todayHtml(s: TodayStats): string {
  return [
    `📊 <b>Bugun, ${s.day.split('-').reverse().join('.')}</b>`,
    '',
    `🛒 Bugun tushgan buyurtmalar: <b>${s.created} ta</b> · ${sum(s.createdSum)}`,
    '',
    '<b>Hozir ochiq buyurtmalar</b>',
    `🆕 ${orderStatusNames.new_}: <b>${s.open.new_}</b>`,
    `⚙️ ${orderStatusNames.processing}: <b>${s.open.processing}</b>`,
    `🚚 ${orderStatusNames.shipping}: <b>${s.open.shipping}</b>`,
    '',
    `💳 To'lanmagan buyurtmalar: <b>${s.unpaid} ta</b>`,
    s.overdue ? `⏰ Muddati o'tgan hisob-fakturalar: <b>${s.overdue.count} ta</b> · ${sum(s.overdue.remaining)}` : null,
  ].filter((l) => l !== null).join('\n');
}

export type DebtRow = { invoiceNo: string; remaining: number; dueDate: Date; customer: string };

/** `rows` — eng eski muddatlilar (10 tagacha), `count` va `remaining` — barcha muddati o'tganlar bo'yicha */
export function debtsHtml(rows: DebtRow[], count: number, remaining: number, now: Date): string {
  if (!count) return "✅ Muddati o'tgan hisob-faktura yo'q.";
  const lines = rows.map((r) => {
    const days = Math.floor((now.getTime() - r.dueDate.getTime()) / 86_400_000);
    return `• <b>${esc(r.invoiceNo)}</b> · ${sum(r.remaining)} · muddati ${formatDate(r.dueDate, 'uz')}${days > 0 ? ` (${days} kun)` : ''} · ${esc(clip(r.customer, 40) || '—')}`;
  });
  return [
    `💸 <b>Muddati o'tgan hisob-fakturalar: ${count} ta</b>`,
    `Jami qoldiq: <b>${sum(remaining)}</b>`,
    '',
    ...lines,
    count > rows.length ? `… yana ${count - rows.length} ta` : null,
  ].filter((l) => l !== null).join('\n');
}

export const debtsKeyboard = (): InlineKeyboard => [[{ text: '🌐 Admin panelda ochish', url: `${siteUrl()}/admin/invoices?status=overdue` }]];
