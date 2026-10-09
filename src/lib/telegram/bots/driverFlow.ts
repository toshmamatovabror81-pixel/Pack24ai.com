/**
 * Haydovchi boti: matnlar (faqat o'zbek), sessiya turlari, variantlar, kalkulyator.
 * Faqat ma'lumot — baza va Telegram chaqiruvlari driver.ts da.
 */

export type DrvStep =
  | 'reg_code' | 'reg_phone'
  | 'acc_name' | 'acc_phone' | 'acc_point' | 'acc_vehicle'
  | 'weigh_weight' | 'weigh_discount' | 'weigh_reason' | 'weigh_reason_text' | 'weigh_confirm'
  | 'reject_text'
  | 'wd_amount'
  | 'card_number' | 'card_holder' | 'card_expiry';

export type DrvSession = {
  step?: DrvStep;
  /** Ro'yxatdan o'tish kodi (telefon kutilmoqda) */
  code?: string;
  acc?: { name?: string; phone?: string; pointId?: number | null; vehicle?: string | null };
  weigh?: { requestId: number; name?: string; weight?: number; discount?: number; reason?: string | null };
  rejectId?: number;
  /** Karta raqami to'liq saqlanmaydi: faqat birinchi 4 (turi uchun) va oxirgi 4 (niqob uchun) */
  card?: { first4: string; last4: string; holder?: string };
};

/** "Orqaga": qadamning oldingi qadami (yo'q bo'lsa — bekor qilish bilan bir xil) */
export function prevDrvStep(step: DrvStep, s: DrvSession): DrvStep | null {
  switch (step) {
    case 'reg_phone': return 'reg_code';
    case 'acc_phone': return 'acc_name';
    case 'acc_point': return 'acc_phone';
    case 'acc_vehicle': return 'acc_point';
    case 'weigh_discount': return 'weigh_weight';
    case 'weigh_reason': return 'weigh_discount';
    case 'weigh_reason_text': return 'weigh_reason';
    case 'weigh_confirm': return (s.weigh?.discount ?? 0) > 0 ? 'weigh_reason' : 'weigh_discount';
    case 'card_holder': return 'card_number';
    case 'card_expiry': return 'card_holder';
    default: return null;
  }
}

export const M = {
  tasks: '🚚 Topshiriqlar',
  weigh: '⚖️ Tortish',
  goOnline: "🟢 Onlayn bo'lish",
  goOffline: "🔴 Oflayn bo'lish",
  wallet: '💰 Hamyon',
  sendLocation: '📍 Joylashuv yuborish',
  password: '🔑 Parol',
  info: "ℹ️ Ma'lumot",
  accessRequest: "📝 Kirish so'rovi yuborish",
  shareContact: '📱 Raqamni ulashish',
  back: '⬅️ Orqaga',
  cancel: '❌ Bekor qilish',
  skip: "⏭ O'tkazib yuborish",
} as const;

export const REJECT_REASONS = [
  { key: 'band', label: 'Bandman' },
  { key: 'uzoq', label: 'Juda uzoq' },
  { key: 'mashina', label: 'Mashina nosoz' },
  { key: 'boshqa', label: 'Boshqa sabab' },
] as const;
export const rejectReasonLabel = (key: string) => REJECT_REASONS.find((r) => r.key === key)?.label ?? null;

export const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

export const DISCOUNT_REASONS = [
  { key: 'namlik', label: 'Namlik' },
  { key: 'iflos', label: 'Iflos' },
  { key: 'aralash', label: 'Aralash' },
  { key: 'boshqa', label: 'Boshqa' },
] as const;
export const discountReasonLabel = (key: string) => DISCOUNT_REASONS.find((r) => r.key === key)?.label ?? null;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tortish kalkulyatori (lib/recycling/collections.ts bilan bir xil formula; u 'server-only' bo'lgani uchun takrorlangan):
 * effektiv = round2(w × (1 − d/100)), jami = round(effektiv × narx), daromad = round(w × stavka).
 */
export function weighPreview(weight: number, discount: number, pricePerKg: number, driverRatePerKg: number) {
  const w = Math.max(0, Number(weight) || 0);
  const d = Math.min(100, Math.max(0, Number(discount) || 0));
  const effective = round2(w * (1 - d / 100));
  const total = Math.round(effective * (Number(pricePerKg) || 0));
  const earning = Math.round(w * (Number(driverRatePerKg) || 0));
  return { weight: w, discount: d, effective, total, earning };
}

export const driverStatusLabel: Record<'active' | 'inactive' | 'on_route' | 'busy', string> = {
  active: "Bo'sh", inactive: 'Faol emas', on_route: "Yo'lda", busy: 'Band',
};

export const txTypeLabel: Record<'earning' | 'withdrawal' | 'bonus', string> = { earning: 'Daromad', withdrawal: 'Yechib olish', bonus: 'Bonus' };
export const txStatusLabel: Record<'pending' | 'completed' | 'failed', string> = { pending: '⏳', completed: '✅', failed: '❌' };
export const cardTypeLabel: Record<'uzcard' | 'humo' | 'visa' | 'mastercard' | 'other', string> = { uzcard: 'Uzcard', humo: 'Humo', visa: 'Visa', mastercard: 'Mastercard', other: 'Karta' };

export const D = {
  regIntro: "👋 <b>Pack24 haydovchi boti</b>\n\nRo'yxatdan o'tish uchun masuldan olgan <b>5 xonali kodni</b> yuboring.\n\nKodingiz yo'qmi? «📝 Kirish so'rovi yuborish» tugmasini bosing.",
  regPending: "⏳ Kirish so'rovingiz ko'rib chiqilmoqda. Tasdiqlangach xabar beramiz.",
  badCode: "❗️ Kod 5 ta raqamdan iborat bo'lishi kerak. Masalan: <code>12345</code>",
  askRegPhone: "📱 Endi telefon raqamingizni <b>tugma orqali</b> ulashing (kod shu raqamga tekshiriladi).",
  ownContactOnly: "❗️ Faqat o'z raqamingizni ulashing (tugma orqali).",
  badPhone: "❗️ Raqam noto'g'ri.",
  regFail: {
    code: "❌ Kod noto'g'ri yoki eskirgan. Masuldan yangi kod oling.",
    phone: "❌ Bu raqam kodga mos emas. Masulga bergan raqamingizni ulashing.",
    taken: "❌ Bu Telegram boshqa haydovchiga bog'langan. Masulga murojaat qiling.",
    inactive: "❌ Haydovchi yozuvi faol emas. Masulga murojaat qiling.",
  },
  registered: (name: string) => `✅ <b>Xush kelibsiz, ${name}!</b> Ro'yxatdan o'tdingiz.`,
  cabinet: (url: string, phone: string, password: string | null) =>
    `🖥 <b>Haydovchi kabineti:</b> <a href="${url}">${url}</a>\n👤 Login: <code>${phone}</code>\n${password ? `🔑 Parol: <code>${password}</code>\n<i>Parol faqat bir marta ko'rsatiladi — saqlab qo'ying.</i>` : "🔑 Parol avval berilgan. Yangisini «🔑 Parol» orqali oling."}`,
  askAccName: "📝 <b>Kirish so'rovi</b>\n\nIsm-familiyangizni yozing:",
  badName: "❗️ Ism kamida 2 ta harf bo'lsin.",
  askAccPhone: '📱 Telefon raqamingizni tugma orqali ulashing:',
  askAccPoint: '🏭 Qaysi punktda ishlamoqchisiz?',
  noPoint: "➖ Hozircha bilmayman",
  askVehicle: "🚚 Mashina ma'lumoti (rusumi, raqami), masalan: <code>Damas 01 A 123 BC</code>",
  accSent: "✅ So'rov yuborildi. HQ admin tasdiqlagach xabar beramiz.",
  accDuplicate: "ℹ️ Bu raqam allaqachon haydovchi sifatida ro'yxatda — masuldan kod oling va shu yerga yuboring.",
  menuHint: 'Menyudan tanlang 👇',
  notRegistered: "Avval ro'yxatdan o'ting: /start",
  help: "ℹ️ <b>Yordam</b>\n/tasks — topshiriqlar\n/password — kabinet parolini yangilash\n/start — bosh menyu\n\nMenyu: topshiriqlar, tortish, hamyon, joylashuv, ma'lumot.",
  noTasks: "🚚 Hozircha faol topshiriq yo'q. Onlayn bo'lib turing — yangi topshiriq kelganda xabar beramiz.",
  tasksTitle: (n: number) => `🚚 <b>Faol topshiriqlar: ${n}</b>`,
  btn: {
    accept: '✅ Qabul qilaman', reject: '❌ Rad etaman', enroute: "🚗 Yo'lga chiqdim", arrived: '📍 Yetib keldim', weigh: '⚖️ Tortish',
    map: '🗺 Yandex xarita', back: '⬅️ Orqaga', save: '✅ Saqlash', redo: '✏️ Qaytadan', cancel: '❌ Bekor',
    withdraw: '💳 Yechib olish', addCard: "➕ Karta qo'shish", pwYes: '✅ Ha, yangi parol', pwNo: "❌ Yo'q",
  },
  notYours: 'Bu topshiriq sizga tegishli emas',
  accepted: '✅ Qabul qilindi. Tayyor bo\'lganda «Yo\'lga chiqdim» tugmasini bosing.',
  askRejectReason: '❌ Rad etish sababi?',
  askRejectText: '✍️ Sababni qisqacha yozing:',
  rejected: (reason: string) => `❌ Topshiriq rad etildi: ${reason}. Masulga xabar berildi.`,
  enroute: "🚗 Yo'ldasiz. Mijoz va masulga xabar ketdi. Yetib kelganda tugmani bosing.",
  arrived: '📍 Yetib keldingiz. Endi makulaturani torting.',
  weighOnlyAfterArrive: 'Avval «Yetib keldim» tugmasini bosing',
  requestFinished: 'Bu ariza allaqachon yakunlangan',
  restartWeigh: 'Tortishni qaytadan boshlang',
  restartAccess: 'Qaytadan boshlang: /start',
  weighRedo: '(qayta)',
  noWeigh: "⚖️ Tortish uchun topshiriq yo'q (avval yetib kelganingizni belgilang).",
  chooseWeigh: '⚖️ Qaysi topshiriqni tortasiz?',
  askWeight: (id: number, name: string) => `⚖️ <b>Ariza #${id} · ${name}</b>\n\nHaqiqiy og'irlikni kg da yozing, masalan: <code>120.5</code>`,
  badWeight: "❗️ Og'irlik 0 dan katta raqam bo'lsin, masalan: <code>120.5</code>",
  askDiscount: (kg: number) => `➖ <b>Chegirma</b> (${kg} kg uchun)\nSifat, namlik va h.k. uchun foiz tanlang:`,
  askDiscountReason: '📝 Chegirma sababi?',
  askDiscountText: '✍️ Sababni qisqacha yozing:',
  weighSummary: (p: { id: number; name: string; weight: number; discount: number; reason: string | null; effective: number; price: number; total: string; earning: string }) =>
    [
      `🧮 <b>Hisob-kitob · Ariza #${p.id}</b>`,
      `👤 ${p.name}`,
      `⚖️ Og'irlik: <b>${p.weight} kg</b>`,
      p.discount > 0 ? `➖ Chegirma: ${p.discount}%${p.reason ? ` (${p.reason})` : ''} → ${p.effective} kg` : '➖ Chegirma: 0%',
      `💵 Punkt narxi: ${p.price} so'm/kg`,
      `💰 Jami mijozga: <b>${p.total}</b>`,
      `🚛 Sizning daromadingiz: <b>${p.earning}</b>`,
    ].join('\n'),
  weighSaved: (earning: string) => `✅ <b>Tortish saqlandi.</b> Mijozga tasdiqlash yuborildi.\n🚛 Daromadingiz: <b>${earning}</b> (hamyonga qo'shildi)`,
  weighCancelled: '❌ Tortish bekor qilindi.',
  online: "🟢 Siz onlaynsiz — topshiriqlar kelishi mumkin.",
  offline: '🔴 Siz oflaynsiz.',
  locationSaved: '📍 Joylashuv saqlandi. Masul sizni xaritada ko\'radi.',
  walletTitle: '💰 <b>Hamyon</b>',
  wallet: { balance: 'Balans', earned: 'Jami daromad', withdrawn: 'Yechilgan', pending: 'Kutilmoqda', recent: 'Oxirgi tranzaksiyalar', none: "— hali yo'q", cards: 'Kartalar', noCards: "— karta qo'shilmagan" },
  lowBalance: (min: string, balance: string) => `Kamida ${min} kerak. Balans: ${balance}`,
  askAmount: (balance: string, min: string) => `💳 <b>Yechib olish</b>\nBalans: <b>${balance}</b> · minimal: ${min}\n\nSummani yozing yoki tugmani bosing:`,
  allBalance: (balance: string) => `💵 Hammasi: ${balance}`,
  badAmount: "❗️ Summani raqam bilan yozing, masalan: <code>50000</code>",
  wdSent: (sum: string, where: string) => `✅ So'rov yuborildi: <b>${sum}</b> (${where}). Masul tasdiqlagach xabar beramiz.`,
  askCardNumber: "💳 <b>Karta qo'shish</b>\nKarta raqamini yozing (16 raqam):",
  badCard: "❗️ Karta raqami 16 ta raqam bo'lsin.",
  askHolder: (mask: string, type: string) => `${type} <code>${mask}</code>\n\n👤 Karta egasining ismini yozing:`,
  askExpiry: '📅 Amal qilish muddati (OO/YY), masalan: <code>12/27</code>',
  badExpiry: "❗️ Muddat noto'g'ri. Namuna: <code>12/27</code>",
  cardAdded: (mask: string, type: string, isDefault: boolean) => `✅ Karta qo'shildi: ${type} <code>${mask}</code>${isDefault ? ' (asosiy)' : ''}`,
  pwConfirm: "🔑 Kabinet uchun <b>yangi parol</b> yaratilsinmi? Eski parol ishlamay qoladi.",
  pwKept: "Parol o'zgartirilmadi.",
  pwNew: (password: string, url: string, phone: string) => `🔑 <b>Yangi parol:</b> <code>${password}</code>\n\n🖥 Kabinet: <a href="${url}">${url}</a>\n👤 Login: <code>${phone}</code>\n<i>Parolni saqlab qo'ying — xabarni o'chirib yuborishingiz mumkin.</i>`,
  infoTitle: "ℹ️ <b>Ma'lumot</b>",
  info: { name: '👤 Ism', phone: '📞 Telefon', point: '🏭 Punkt', supervisor: '🧑‍💼 Masul', vehicle: '🚚 Mashina', status: '📊 Holat', online: '🟢 Onlayn', offline: '🔴 Oflayn', since: '📅 Botda', none: '—' },
  cancelled: '❌ Bekor qilindi.',
} as const;
