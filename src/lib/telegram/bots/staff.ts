import 'server-only';
import type { OrderStatus, Prisma } from '@prisma/client';
import { can, type Section } from '@/lib/auth/permissions';
import { tashkentClock } from '@/lib/cron';
import { prisma } from '@/lib/db';
import { normalizePhone, toNumber } from '@/lib/format';
import { overdueInvoiceWhere } from '@/lib/invoiceStatus';
import { changeOrderStatus, setManualPayment, type Actor } from '@/lib/orderFlow';
import { isManualPayment, ORDER_FLOW } from '@/lib/orderStatus';
import { inline, removeKeyboard } from '../api';
import { createBot, idFrom, type Ctx } from '../router';
import { clearSession, getSession, setSession } from '../session';
import { cancelConfirmKeyboard, canMarkPaid, payConfirmKeyboard, staffOrder, staffOrderHtml, staffOrderKeyboard, staffOrderLine, type StaffOrder } from '../staffCards';
import { linkStaffByCode, linkStaffByPhone, setStaffNotify, staffByTelegram, unlinkStaff, type StaffUser } from '../staffLink';
import {
  backRow, BTN, cancelAskHtml, classifyFind, CODE_MAX_FAILS, codeFailed, codeLockedHtml, codeLockLeft, codeWrongHtml, commandArg, debtsHtml, debtsKeyboard,
  FIND_HINT, FIND_PROMPT, guestHtml, guestKeyboard, helpHtml, isLinkCode, listHtml, listKeyboard, listPageSize, menuHint, menuKeyboard, notifyHtml,
  notInStaffListHtml, ORDER_HINT, orderGoneHtml, OWN_CONTACT_ONLY, paidNote, payAskHtml, parseListData, parseStatusData, statusNote, STOP_ASK, stopKeyboard, todayHtml, welcomeHtml,
  type CodeGuard, type ListKind,
} from './staffViews';

/**
 * Boshqaruv boti (@pack24AUP_bot) — admin paneldagi Xodimlar ro'yxatidagi xodimlar uchun: yangi buyurtma va to'lov
 * xabarlari, buyurtma holatini o'zgartirish, qidiruv, bugungi raqamlar, muddati o'tgan qarzlar.
 * Xavfsizlik qoidasi bitta: HAR BIR xabar va tugma bosilishida xodim bazadan qayta olinadi (staffOnly) va bo'lim
 * ruxsati tekshiriladi. Ulanmagan odam faqat "qanday ulanish" matnini ko'radi — hech qanday ichki ma'lumot chiqmaydi.
 * Matnlar va tugmalar staffViews.ts da, buyurtma kartasi staffCards.ts da (xabarnomalar ham shu kartani yuboradi).
 */
export const bot = createBot('staff');

type StaffSession = { step?: 'find' };
type StaffHandler = (ctx: Ctx, staff: StaffUser) => Promise<unknown>;

const STALE_BUTTON = 'Bu tugma eskirgan. /start bosing.';
const STATUS_MOVED = "Holat allaqachon o'zgargan";
const REFRESHED = 'Yangilandi ✅';
/** Noto'g'ri kodlar hisobi turadigan sessiya kaliti: suhbat sessiyasidan ('staff') alohida qator, ctx.clearSession() unga tegmaydi */
const CODE_GUARD = 'staff_code';

/** Bot faqat shaxsiy chatda javob beradi: guruhga qo'shib qo'yilsa ham buyurtma ma'lumoti u yerga chiqmaydi */
const isPrivate = (ctx: Ctx) => ctx.message?.chat.type === 'private';
/** "🔄" tugmasining o'zi bosildimi (ro'yxatdan karta ochish, "Yo'q" yoki "Ro'yxatga qaytish" emas): hech narsa o'zgarmagan bo'lsa ham xodim javob ko'rsin */
const isRefresh = (ctx: Ctx) => !!ctx.message?.reply_markup?.inline_keyboard.some((row) => row.some((b) => b.callback_data === ctx.data && b.text.startsWith('🔄')));

const actorOf = (staff: StaffUser): Actor => ({ name: staff.name, via: 'staff_bot' });

async function guestStart(ctx: Ctx): Promise<void> {
  await ctx.reply(guestHtml(), { reply_markup: guestKeyboard() });
}

/**
 * Xodim har so'rovda bazadan qayta olinadi: admin panelda o'chirilgan, uzilgan yoki roli o'zgargan xodim
 * keyingi bosishdayoq eski huquqini yo'qotadi (chatda qolgan eski tugmalar ham ishlamaydi).
 */
function staffOnly(h: StaffHandler, section?: Section): (ctx: Ctx) => Promise<void> {
  return async (ctx) => {
    if (!isPrivate(ctx)) return;
    const staff = await staffByTelegram(ctx.from.id);
    if (!staff) {
      if (ctx.callback) await ctx.answer('Avval botga ulaning: /start', true);
      else await guestStart(ctx);
      return;
    }
    if (section && !can(staff.role, section)) {
      if (ctx.callback) await ctx.answer("Ruxsat yo'q", true);
      // Menyu qayta yuboriladi: rol o'zgargan bo'lsa ekrandagi eski tugmalar yangisiga almashadi
      else await ctx.reply("⛔ Bu bo'limga ruxsatingiz yo'q.", { reply_markup: menuKeyboard(staff.role) });
      return;
    }
    await h(ctx, staff);
  };
}

/** Menyu tugmasi yoki buyruq: boshlab qo'yilgan qidiruv bosqichi bekor bo'ladi */
const menuItem = (h: StaffHandler, section?: Section) =>
  staffOnly(async (ctx, staff) => {
    await ctx.clearSession();
    await h(ctx, staff);
  }, section);

// ─── Ulanish ─────────────────────────────────────────────────────────────────

async function linked(ctx: Ctx, staff: StaffUser): Promise<void> {
  await ctx.clearSession();
  await ctx.reply(welcomeHtml(staff, true), { reply_markup: menuKeyboard(staff.role) });
}

/**
 * Bir martalik kod. Urinish tekshiruvdan OLDIN sanab qo'yiladi (kod to'g'ri chiqsa hisob tozalanadi):
 * ketma-ket yuborilgan xabarlar hisobni chetlab o'tmasin. Qulf paytida kod bazadan umuman qidirilmaydi.
 * Hisob suhbat sessiyasidan ALOHIDA qatorda turadi (CODE_GUARD): ulangan xodim "/stop -> 5 ta kod -> telefon bilan qayta
 * ulanish -> /stop ..." qilib (ulanish va menyu suhbat sessiyasini tozalaydi) hisobni nolga tushira olmasin.
 */
async function tryCode(ctx: Ctx, code: string): Promise<void> {
  const now = Date.now();
  const guard = await getSession<CodeGuard>(CODE_GUARD, ctx.from.id);
  const left = codeLockLeft(guard, now);
  if (left > 0) {
    await ctx.reply(codeLockedHtml(left), { reply_markup: guestKeyboard() });
    return;
  }
  const next = codeFailed(guard, now);
  await setSession<CodeGuard>(CODE_GUARD, ctx.from.id, next);
  const res = await linkStaffByCode(ctx.from.id, code);
  if (res.ok) {
    await clearSession(CODE_GUARD, ctx.from.id);
    return linked(ctx, res.user);
  }
  const lockedFor = codeLockLeft(next, now);
  await ctx.reply(lockedFor > 0 ? codeLockedHtml(lockedFor) : codeWrongHtml(CODE_MAX_FAILS - next.codeFails), { reply_markup: guestKeyboard() });
}

bot.command('start', async (ctx) => {
  if (!isPrivate(ctx)) return;
  const staff = await staffByTelegram(ctx.from.id);
  if (staff) {
    await ctx.clearSession();
    await ctx.reply(welcomeHtml(staff, false), { reply_markup: menuKeyboard(staff.role) });
    return;
  }
  const arg = commandArg(ctx.text);
  if (isLinkCode(arg)) await tryCode(ctx, arg);
  else await guestStart(ctx);
});

bot.contact(async (ctx) => {
  if (!isPrivate(ctx)) return;
  const contact = ctx.message?.contact;
  if (!contact) return;
  const staff = await staffByTelegram(ctx.from.id);
  if (staff) {
    // Ulangan xodim yuborgan kontakt — shaxsni tasdiqlash emas, qidiruv: mijozning kontakt kartasi bo'yicha buyurtmalari
    const phone = can(staff.role, 'orders') ? normalizePhone(contact.phone_number) : null;
    if (phone) await showList(ctx, { key: 'phone', phone }, 0);
    else await ctx.reply(menuHint(staff.role), { reply_markup: menuKeyboard(staff.role) });
    return;
  }
  // Faqat Telegram tasdiqlagan O'Z raqami: boshqa odamning kontaktini yuborib, uning nomidan ulanib bo'lmaydi
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply(OWN_CONTACT_ONLY, { reply_markup: guestKeyboard() });
    return;
  }
  const res = await linkStaffByPhone(ctx.from.id, contact.phone_number);
  if (res.ok) await linked(ctx, res.user);
  else await ctx.reply(notInStaffListHtml(contact.phone_number), { reply_markup: guestKeyboard() });
});

// ─── Ro'yxatlar ──────────────────────────────────────────────────────────────

function listWhere(kind: ListKind): Prisma.OrderWhereInput {
  if (kind.key === 'new') return { deletedAt: null, status: 'new_' };
  if (kind.key === 'active') return { deletedAt: null, status: { in: ['processing', 'shipping'] } };
  return { deletedAt: null, contactPhone: kind.phone };
}

/** Ro'yxat sahifasi (yangilari tepada). Tugmadan chaqirilsa o'sha xabar o'rnida yangilanadi. */
async function showList(ctx: Ctx, kind: ListKind, page: number): Promise<void> {
  const where = listWhere(kind);
  const size = listPageSize(kind);
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const items = total
    ? await prisma.order.findMany({ where, orderBy: { id: 'desc' }, skip: p * size, take: size, select: { id: true, status: true, totalAmount: true, createdAt: true, customerName: true } })
    : [];
  const html = listHtml(kind, items.map(staffOrderLine), total, p, pages);
  const rows = listKeyboard(kind, items.map((o) => o.id), p, pages);
  if (ctx.callback) await ctx.edit(html, rows);
  else await ctx.reply(html, { reply_markup: inline(rows) });
}

const showNew: StaffHandler = (ctx) => showList(ctx, { key: 'new' }, 0);
const showActive: StaffHandler = (ctx) => showList(ctx, { key: 'active' }, 0);
bot.command('new', menuItem(showNew, 'orders'));
bot.hears(BTN.newOrders, menuItem(showNew, 'orders'));
bot.command('active', menuItem(showActive, 'orders'));
bot.hears(BTN.active, menuItem(showActive, 'orders'));

const listPage = staffOnly(async (ctx) => {
  const parsed = parseListData(ctx.data);
  if (!parsed) return ctx.answer(STALE_BUTTON, true);
  await showList(ctx, parsed.kind, parsed.page);
  if (isRefresh(ctx)) await ctx.answer(REFRESHED);
}, 'orders');
bot.callback('sl_', listPage);
bot.callback('sb_', listPage);

// ─── Buyurtma kartasi ────────────────────────────────────────────────────────

/** Ro'yxatdan ochilgan kartada "Ro'yxatga qaytish" tugmasi keyingi tahrirlarda ham saqlanib qoladi */
const backOf = (ctx: Ctx) => (ctx.callback ? backRow(ctx.message?.reply_markup?.inline_keyboard) : []);

/** Buyurtma kartasi (har doim bazadagi hozirgi holat). Tugmadan chaqirilsa o'sha xabar o'rnida yangilanadi. */
async function showCard(ctx: Ctx, staff: StaffUser, id: number, note?: string): Promise<void> {
  const o = await staffOrder(id);
  if (!o) {
    if (!ctx.callback) return void (await ctx.reply(orderGoneHtml(id)));
    await ctx.answer('Buyurtma topilmadi', true);
    await ctx.edit(orderGoneHtml(id), backOf(ctx));
    return;
  }
  const rows = [...staffOrderKeyboard(o, can(staff.role, 'orders')), ...backOf(ctx)];
  if (ctx.callback) await ctx.edit(staffOrderHtml(o, note), rows);
  else await ctx.reply(staffOrderHtml(o, note), { reply_markup: inline(rows) });
}

/**
 * Holatni o'zgartirish faqat tabiiy yo'l bo'yicha (enforceFlow): eski xabardagi tugma yoki ikki xodimning bir vaqtda
 * bosishi xato holat qo'ymaydi — bunday holda "allaqachon o'zgargan" deyiladi va karta hozirgi holatga yangilanadi.
 */
async function applyStatus(ctx: Ctx, staff: StaffUser, id: number, status: OrderStatus): Promise<void> {
  const res = await changeOrderStatus(id, status, actorOf(staff), { enforceFlow: true });
  if (res.ok && res.changed) return showCard(ctx, staff, id, statusNote(status, staff.name));
  if (res.ok || res.reason !== 'not_found') await ctx.answer(STATUS_MOVED, true);
  await showCard(ctx, staff, id);
}

async function askCancel(ctx: Ctx, staff: StaffUser, id: number): Promise<void> {
  const o = await staffOrder(id);
  if (!o || !ORDER_FLOW[o.status].includes('cancelled')) {
    if (o) await ctx.answer(STATUS_MOVED, true);
    return showCard(ctx, staff, id);
  }
  await ctx.edit(`${staffOrderHtml(o)}\n\n${cancelAskHtml(id)}`, [...cancelConfirmKeyboard(id), ...backOf(ctx)]);
}

/** Karta tugmalari: har birida "orders" ruxsati qayta tekshiriladi, id callback_data dan olinadi */
const orderAction = (prefix: string, h: (ctx: Ctx, staff: StaffUser, id: number) => Promise<unknown>) =>
  bot.callback(prefix, staffOnly(async (ctx, staff) => {
    const id = idFrom(ctx.data, prefix);
    if (id == null) await ctx.answer(STALE_BUTTON, true);
    else await h(ctx, staff, id);
  }, 'orders'));

bot.callback('os_', staffOnly(async (ctx, staff) => {
  const parsed = parseStatusData(ctx.data);
  if (!parsed) await ctx.answer(STALE_BUTTON, true);
  // Bekor qilish har doim tasdiq bilan (karta buning uchun oc_ yuboradi)
  else if (parsed.status === 'cancelled') await askCancel(ctx, staff, parsed.id);
  else await applyStatus(ctx, staff, parsed.id, parsed.status);
}, 'orders'));
orderAction('oc_', askCancel);
orderAction('ocy_', (ctx, staff, id) => applyStatus(ctx, staff, id, 'cancelled'));
orderAction('or_', async (ctx, staff, id) => {
  await showCard(ctx, staff, id);
  // Buyurtma topilmagan bo'lsa showCard o'zi javob bergan — router ikkinchi javobni yubormaydi
  if (isRefresh(ctx)) await ctx.answer(REFRESHED);
});
/**
 * "To'landi" ikki bosqichli (op_ so'raydi, opy_ bajaradi): to'lov belgilanganda mijozga xabar ketadi va buyurtmaning
 * hisob-fakturasi ham yopiladi — buni botdan ortga qaytarib bo'lmaydi, shuning uchun bitta tasodifiy bosish yetarli bo'lmasin.
 * Ikkala bosqichda ham shart qayta tekshiriladi: eski xabardagi tugma chatda qolib ketadi.
 */
async function payable(ctx: Ctx, staff: StaffUser, id: number): Promise<StaffOrder | null> {
  const o = await staffOrder(id);
  if (o && !isManualPayment(o.paymentMethod)) await ctx.answer("Onlayn to'lovni Payme / Click o'zi avtomatik belgilaydi", true);
  // Bekor qilingan, to'langan yoki puli qaytarilgan buyurtmaga "to'landi" qo'yilmaydi (mijozga noto'g'ri xabar ketmasin)
  else if (o && !canMarkPaid(o)) await ctx.answer(o.status === 'cancelled' ? 'Buyurtma bekor qilingan' : "To'lov holati allaqachon o'zgargan", true);
  else if (o) return o;
  await showCard(ctx, staff, id);
  return null;
}

orderAction('op_', async (ctx, staff, id) => {
  const o = await payable(ctx, staff, id);
  if (o) await ctx.edit(`${staffOrderHtml(o)}\n\n${payAskHtml(id, o.corporateInvoices[0]?.invoiceNo)}`, [...payConfirmKeyboard(id), ...backOf(ctx)]);
});
orderAction('opy_', async (ctx, staff, id) => {
  if (!(await payable(ctx, staff, id))) return;
  const res = await setManualPayment(id, 'paid', actorOf(staff));
  if (res.ok && res.changed) return showCard(ctx, staff, id, paidNote(staff.name));
  if (!res.ok && res.reason === 'online') await ctx.answer("Onlayn to'lovni Payme / Click o'zi avtomatik belgilaydi", true);
  else if (res.ok || res.reason !== 'not_found') await ctx.answer("To'lov holati allaqachon o'zgargan", true);
  await showCard(ctx, staff, id);
});

// ─── Qidiruv ─────────────────────────────────────────────────────────────────

/** Buyurtma raqami -> karta, telefon -> shu telefonli oxirgi buyurtmalar. Tushunilmasa false. */
async function find(ctx: Ctx, staff: StaffUser, input: string): Promise<boolean> {
  const q = classifyFind(input);
  if (q.kind === 'order') await showCard(ctx, staff, q.id);
  else if (q.kind === 'phone') await showList(ctx, { key: 'phone', phone: q.phone }, 0);
  return q.kind !== 'none';
}

const askFind: StaffHandler = async (ctx) => {
  await ctx.setSession<StaffSession>({ step: 'find' });
  await ctx.reply(FIND_PROMPT);
};
bot.hears(BTN.find, staffOnly(askFind, 'orders'));
bot.command('find', menuItem(async (ctx, staff) => {
  const arg = commandArg(ctx.text);
  if (!arg) await askFind(ctx, staff);
  else if (!(await find(ctx, staff, arg))) await ctx.reply(FIND_HINT);
}, 'orders'));
bot.command('order', menuItem(async (ctx, staff) => {
  const q = classifyFind(commandArg(ctx.text));
  if (q.kind === 'order') await showCard(ctx, staff, q.id);
  else await ctx.reply(ORDER_HINT);
}, 'orders'));

// ─── Bugun va qarzdorlik ─────────────────────────────────────────────────────

/** Bugungi raqamlar: admin paneldagi bosh sahifa bilan bir xil hisob (bekor qilinganlar va qoralamalar kirmaydi) */
const showToday: StaffHandler = async (ctx, staff) => {
  const now = new Date();
  const { day } = tashkentClock(now);
  const real: Prisma.OrderWhereInput = { deletedAt: null, status: { notIn: ['draft', 'cancelled'] } };
  const [created, open, unpaid, overdue] = await Promise.all([
    prisma.order.aggregate({ where: { ...real, createdAt: { gte: new Date(`${day}T00:00:00+05:00`) } }, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.order.groupBy({ by: ['status'], where: { deletedAt: null, status: { in: ['new_', 'processing', 'shipping'] } }, _count: { _all: true } }),
    prisma.order.count({ where: { ...real, paymentStatus: { in: ['pending', 'processing', 'failed'] } } }),
    can(staff.role, 'finance') ? prisma.corporateInvoice.aggregate({ where: overdueInvoiceWhere(now), _count: { _all: true }, _sum: { totalAmount: true, paidAmount: true } }) : null,
  ]);
  const openBy = (s: OrderStatus) => open.find((g) => g.status === s)?._count._all ?? 0;
  await ctx.reply(todayHtml({
    day,
    created: created._count._all,
    createdSum: toNumber(created._sum.totalAmount),
    open: { new_: openBy('new_'), processing: openBy('processing'), shipping: openBy('shipping') },
    unpaid,
    overdue: overdue ? { count: overdue._count._all, remaining: toNumber(overdue._sum.totalAmount) - toNumber(overdue._sum.paidAmount) } : null,
  }));
};
bot.command('today', menuItem(showToday, 'orders'));
bot.hears(BTN.today, menuItem(showToday, 'orders'));

/** Muddati eng ko'p o'tgan 10 ta hisob-faktura (kunlik eslatma bilan bir xil shart: overdueInvoiceWhere) */
const showDebts: StaffHandler = async (ctx) => {
  const now = new Date();
  const where = overdueInvoiceWhere(now);
  const [rows, all] = await Promise.all([
    prisma.corporateInvoice.findMany({
      where, orderBy: { dueDate: 'asc' }, take: 10,
      select: { invoiceNo: true, totalAmount: true, paidAmount: true, dueDate: true, order: { select: { customerName: true, companyName: true } } },
    }),
    prisma.corporateInvoice.aggregate({ where, _count: { _all: true }, _sum: { totalAmount: true, paidAmount: true } }),
  ]);
  const html = debtsHtml(
    rows.map((r) => ({ invoiceNo: r.invoiceNo, remaining: toNumber(r.totalAmount) - toNumber(r.paidAmount), dueDate: r.dueDate, customer: r.order.companyName || r.order.customerName || '' })),
    all._count._all,
    toNumber(all._sum.totalAmount) - toNumber(all._sum.paidAmount),
    now,
  );
  await ctx.reply(html, { reply_markup: inline(debtsKeyboard()) });
};
bot.command('debts', menuItem(showDebts, 'finance'));
bot.hears(BTN.debts, menuItem(showDebts, 'finance'));

// ─── Xabarnoma, yordam, uzilish ──────────────────────────────────────────────

bot.hears(BTN.notify, menuItem(async (ctx, staff) => {
  const on = !staff.telegramNotify;
  await setStaffNotify(staff.id, on);
  await ctx.reply(notifyHtml(on), { reply_markup: menuKeyboard(staff.role) });
}));

const showHelp: StaffHandler = (ctx, staff) => ctx.reply(helpHtml(staff.role), { reply_markup: menuKeyboard(staff.role) });
bot.command('help', menuItem(showHelp));
bot.hears(BTN.help, menuItem(showHelp));

bot.command('stop', menuItem((ctx) => ctx.reply(STOP_ASK, { reply_markup: inline(stopKeyboard()) })));
bot.callback('sx_', staffOnly(async (ctx, staff) => {
  if (ctx.data !== 'sx_y') return ctx.edit('👌 Bekor qilindi — bot ulangan holda qoladi.');
  await unlinkStaff(staff.id);
  await ctx.clearSession();
  await ctx.edit('✅ Hisobingiz botdan uzildi.');
  await ctx.reply('👋 Xabarnomalar endi kelmaydi. Qayta ulanish: /start', { reply_markup: removeKeyboard });
}));

// ─── Boshqa har qanday matn ──────────────────────────────────────────────────

bot.text(async (ctx) => {
  if (!isPrivate(ctx)) return;
  const staff = await staffByTelegram(ctx.from.id);
  if (!staff) {
    // Ulanmagan odamdan faqat 6 xonali kod qabul qilinadi; yozib yuborilgan telefon raqami hech qachon shaxsni tasdiqlamaydi
    if (isLinkCode(ctx.text)) await tryCode(ctx, ctx.text);
    else await guestStart(ctx);
    return;
  }
  const orders = can(staff.role, 'orders');
  // Raqam yoki telefon "Qidirish" bosilmasdan yozilsa ham qidiriladi: xodim uchun eng tez yo'l shu
  if (orders && classifyFind(ctx.text).kind !== 'none') {
    await ctx.clearSession();
    await find(ctx, staff, ctx.text);
    return;
  }
  const session = orders ? await ctx.session<StaffSession>() : null;
  if (session?.step === 'find') await ctx.reply(FIND_HINT);
  else await ctx.reply(menuHint(staff.role), { reply_markup: menuKeyboard(staff.role) });
});

/** Xato matni foydalanuvchiga chiqmaydi (ichida so'rov yoki baza tafsiloti bo'lishi mumkin); to'liq xato server logida */
bot.onError(async (_e, ctx) => {
  if (ctx.callback) await ctx.answer("Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.", true);
  else if (isPrivate(ctx)) await ctx.reply("❌ Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring yoki /start bosing.");
});
