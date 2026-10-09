import type { MaterialType } from '@prisma/client';

/**
 * Mijoz boti: matnlar (uz/ru), sessiya turlari va qadamlar grafi.
 * Faqat ma'lumot — baza va Telegram chaqiruvlari customer.ts da.
 */

export type CustLang = 'uz' | 'ru';
export const isCustLang = (v: unknown): v is CustLang => v === 'uz' || v === 'ru';

export type CustStep =
  | 'phone' | 'name' | 'material' | 'volume' | 'volume_custom' | 'pickup' | 'point' | 'location' | 'photo' | 'confirm'
  /** "Yuborish" bosildi, createRequest ketmoqda — takroriy bosishdan himoya */
  | 'sending'
  | 'dispute';

export type CustDraft = {
  phone?: string;
  name?: string;
  material?: MaterialType;
  volume?: number | null;
  pickupType?: 'base' | 'pickup';
  lat?: number;
  lng?: number;
  address?: string;
  pointId?: number;
  pointName?: string;
  km?: number | null;
  photoUrl?: string | null;
};

export type CustSession = {
  lang: CustLang;
  step?: CustStep;
  draft?: CustDraft;
  /** "Rozi emasman" bosilgan ariza — izoh kutilmoqda */
  disputeId?: number;
};

export const VOLUME_OPTIONS = [50, 100, 200, 500] as const;

/** Ariza oqimida "Orqaga": qadamning oldingi qadami (pickup turiga qarab) */
export function prevStep(step: CustStep, draft: CustDraft): CustStep | null {
  switch (step) {
    case 'name': return 'phone';
    case 'material': return 'name';
    case 'volume': return 'material';
    case 'volume_custom': return 'volume';
    case 'pickup': return 'volume';
    case 'point': return 'pickup';
    case 'location': return 'pickup';
    case 'photo': return draft.pickupType === 'pickup' ? 'location' : 'pickup';
    case 'confirm': return 'photo';
    default: return null;
  }
}

const uz = {
  langPrompt: '🌐 Tilni tanlang / Выберите язык',
  langSet: "✅ Til: O'zbekcha",
  hello: (name: string) =>
    `Assalomu alaykum, <b>${name}</b>! 👋\n\nBu <b>Pack24</b> makulatura qabul qilish boti. Bu yerda makulatura topshirish arizasini yuborasiz, holatini kuzatasiz va tortish natijasini tasdiqlaysiz.\n\nQuyidagi menyudan tanlang 👇`,
  menuTitle: '🏠 Bosh menyu',
  menu: {
    request: '♻️ Makulatura topshirish',
    myRequests: '📋 Mening arizalarim',
    points: '📍 Qabul punktlari',
    prices: '💰 Narxlar',
    contact: '☎️ Aloqa',
    lang: '🌐 Til',
  },
  back: '⬅️ Orqaga',
  cancel: '❌ Bekor qilish',
  skip: "⏭ O'tkazib yuborish",
  sharePhone: '📱 Raqamni ulashish',
  shareLocation: '📍 Joylashuvni yuborish',
  findNearest: '📍 Eng yaqin punktni topish',
  stepOf: (n: number, total: number) => `<i>${n}/${total}</i>`,
  askPhone: "📱 <b>Telefon raqamingiz</b>\nTugma orqali ulashing yoki yozing: <code>+998 90 123 45 67</code>",
  badPhone: "❗️ Raqam noto'g'ri. Namuna: <code>+998 90 123 45 67</code>",
  askName: '👤 <b>Ismingiz</b>\nTugmani bosing yoki ismingizni yozing.',
  nameButton: (name: string) => `✅ ${name}`,
  badName: "❗️ Ism kamida 2 ta harf bo'lsin.",
  askMaterial: '♻️ <b>Qanday makulatura?</b>',
  askVolume: '⚖️ <b>Taxminiy og\'irlik (kg)</b>\nTanlang yoki raqam yozing.',
  volOther: '✏️ Boshqa',
  askVolumeCustom: "⚖️ Taxminiy og'irlikni kg da yozing, masalan: <code>120</code>",
  badVolume: "❗️ Raqam kiriting, masalan: <code>120</code>",
  askPickup: '🚚 <b>Qanday topshirasiz?</b>',
  pickupBase: "🏭 O'zim olib boraman",
  pickupPickup: '🚚 Olib ketishsin',
  pickupMinWarn: (min: number, kg: number) =>
    `⚠️ Olib ketish uchun kamida <b>${min} kg</b> bo'lishi kerak (sizda ~${kg} kg).\n\nO'zingiz punktga olib borishingiz yoki hajmni o'zgartirishingiz mumkin.`,
  fixVolume: "✏️ Hajmni o'zgartirish",
  askPoint: '🏭 <b>Qaysi punktga olib borasiz?</b>',
  pointPaused: "⏸ hozir qabul to'xtatilgan",
  askLocation: '📍 <b>Qayerdan olib ketamiz?</b>\nJoylashuvni tugma orqali yuboring yoki manzilni yozing.',
  badAddress: "❗️ Manzilni to'liqroq yozing (kamida 5 ta belgi).",
  nearest: (point: string, km: string) => `🏭 Eng yaqin punkt: <b>${point}</b> (~${km} km)`,
  askPhoto: '📷 <b>Makulatura rasmi</b> (ixtiyoriy)\nRasm yuboring yoki o\'tkazib yuboring.',
  photoSaved: '✅ Rasm qabul qilindi.',
  photoFail: "⚠️ Rasm saqlanmadi, rasmsiz davom etamiz.",
  confirmTitle: '📋 <b>Ariza xulosasi</b>',
  sum: { phone: '📱 Telefon', name: '👤 Ism', material: '♻️ Material', volume: "⚖️ Og'irlik", pickup: '🚚 Turi', location: '📍 Joylashuv', address: '📍 Manzil', point: '🏭 Punkt', photo: '📷 Rasm', yes: 'bor', no: "yo'q", notSet: 'ko\'rsatilmagan' },
  send: '✅ Yuborish',
  restart: '✏️ Qaytadan',
  sent: '✅ Yuborildi',
  created: (id: number) => `✅ <b>Ariza #${id} qabul qilindi!</b>`,
  trackLine: (url: string) => `🔎 Kuzatuv: <a href="${url}">${url}</a>`,
  pointLine: (name: string, address: string | null, hours: string, phone: string) =>
    `🏭 Punkt: <b>${name}</b>${address ? `, ${address}` : ''}\n🕒 ${hours} · ☎️ ${phone}`,
  afterCreate: 'Tez orada operator bog\'lanadi. Holat o\'zgarganda shu yerda xabar beramiz.',
  tooMany: "⚠️ Sizda 5 ta faol ariza bor. Avval ularni yakunlang yoki bekor qiling.",
  errors: {
    phone: "❗️ Telefon noto'g'ri.",
    name: "❗️ Ism noto'g'ri.",
    point: "❗️ Hozircha faol qabul punkti yo'q. Keyinroq urinib ko'ring.",
    min_volume: (min: number) => `❗️ Olib ketish uchun kamida ${min} kg kerak.`,
    location: '❗️ Manzil yoki joylashuv kerak.',
    unknown: "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.",
  },
  cancelled: '❌ Bekor qilindi.',
  flowCancelled: '❌ Ariza to\'ldirish bekor qilindi.',
  disputeCancelled: "❌ Izoh yuborish bekor qilindi. Natijani keyinroq «📋 Mening arizalarim» orqali tasdiqlashingiz mumkin.",
  myRequestsTitle: '📋 <b>Mening arizalarim</b>',
  myRequestsEmpty: "📋 Sizda hali ariza yo'q. «♻️ Makulatura topshirish» tugmasini bosing.",
  view: (id: number) => `🔎 #${id}`,
  toList: "📋 Ro'yxatga",
  cancelReq: '❌ Bekor qilish',
  confirmWeigh: '✅ Tasdiqlayman',
  disputeWeigh: '❌ Rozi emasman',
  trackBtn: '🔎 Saytda kuzatish',
  notFound: 'Ariza topilmadi',
  stale: 'Bu tugma eskirgan',
  cancelledOk: (id: number) => `❌ Ariza #${id} bekor qilindi.`,
  cantCancel: "Haydovchi yo'lga chiqqan — bekor qilish uchun operatorga murojaat qiling",
  cantCancelWeighed: "Tortish yakunlangan — endi bekor qilib bo'lmaydi",
  alreadyFinished: 'Ariza allaqachon yakunlangan yoki bekor qilingan',
  confirmedOk: (id: number) => `🤝 Ariza #${id}: natija tasdiqlandi. Rahmat!`,
  cantDecide: 'Hozir tasdiqlash mumkin emas',
  askDisputeComment: (id: number) => `✍️ Ariza #${id}: nimaga rozi emassiz? Izoh yozing.`,
  skipComment: '⏭ Izohsiz yuborish',
  disputeSent: (id: number) => `⚠️ Ariza #${id}: e'tirozingiz masulga yuborildi. Tez orada bog'lanamiz.`,
  weighTitle: '⚖️ <b>Tortish natijasi</b>',
  weigh: { actual: "Haqiqiy og'irlik", discount: 'Chegirma', effective: 'Hisobga olingan', price: 'Narx', total: 'Jami' },
  linked: '🔗 Ariza botga bog\'landi. Endi holat o\'zgarganda shu yerda xabar olasiz.',
  linkedOther: "⚠️ Bu ariza boshqa Telegram hisobiga bog'langan.",
  pointsTitle: '📍 <b>Qabul punktlari</b>',
  pointsEmpty: "Hozircha faol punkt yo'q.",
  pointsHint: 'Eng yaqin punktni topish uchun joylashuvingizni yuboring 👇',
  hours: '🕒',
  pricesTitle: '💰 <b>Narxlar (so\'m/kg)</b>',
  priceLine: (name: string, price: string) => `🏭 ${name}: <b>${price}/kg</b>`,
  minBase: (kg: number) => `📦 Punktga olib kelishda minimal: <b>${kg} kg</b>`,
  minPickup: (kg: number) => `🚚 Olib ketish uchun minimal: <b>${kg} kg</b>`,
  priceNote: 'Yakuniy summa tortishdan keyin, sifatga qarab hisoblanadi.',
  contactTitle: '☎️ <b>Aloqa</b>',
  contact: { phone: '📞', address: '📍', hours: '🕒', email: '✉️', bot: '🤖' },
  unknown: 'Menyudan tanlang 👇',
  help: "ℹ️ <b>Yordam</b>\n/start — bosh menyu\n/requests — mening arizalarim\n/help — yordam\n\nSavollar: «☎️ Aloqa» bo'limi.",
};

export type CustTexts = typeof uz;

const ru: CustTexts = {
  langPrompt: '🌐 Tilni tanlang / Выберите язык',
  langSet: '✅ Язык: Русский',
  hello: (name: string) =>
    `Здравствуйте, <b>${name}</b>! 👋\n\nЭто бот приёма макулатуры <b>Pack24</b>. Здесь вы отправляете заявку на сдачу макулатуры, следите за её статусом и подтверждаете результат взвешивания.\n\nВыберите в меню 👇`,
  menuTitle: '🏠 Главное меню',
  menu: {
    request: '♻️ Сдать макулатуру',
    myRequests: '📋 Мои заявки',
    points: '📍 Пункты приёма',
    prices: '💰 Цены',
    contact: '☎️ Контакты',
    lang: '🌐 Язык',
  },
  back: '⬅️ Назад',
  cancel: '❌ Отмена',
  skip: '⏭ Пропустить',
  sharePhone: '📱 Отправить номер',
  shareLocation: '📍 Отправить геолокацию',
  findNearest: '📍 Найти ближайший пункт',
  stepOf: (n: number, total: number) => `<i>${n}/${total}</i>`,
  askPhone: '📱 <b>Ваш телефон</b>\nПоделитесь кнопкой или напишите: <code>+998 90 123 45 67</code>',
  badPhone: '❗️ Неверный номер. Пример: <code>+998 90 123 45 67</code>',
  askName: '👤 <b>Ваше имя</b>\nНажмите кнопку или напишите имя.',
  nameButton: (name: string) => `✅ ${name}`,
  badName: '❗️ Имя — минимум 2 буквы.',
  askMaterial: '♻️ <b>Какая макулатура?</b>',
  askVolume: '⚖️ <b>Примерный вес (кг)</b>\nВыберите или напишите число.',
  volOther: '✏️ Другое',
  askVolumeCustom: 'Напишите примерный вес в кг, например: <code>120</code>',
  badVolume: '❗️ Введите число, например: <code>120</code>',
  askPickup: '🚚 <b>Как сдадите?</b>',
  pickupBase: '🏭 Привезу сам',
  pickupPickup: '🚚 Вызвать машину',
  pickupMinWarn: (min: number, kg: number) =>
    `⚠️ Для вывоза нужно минимум <b>${min} кг</b> (у вас ~${kg} кг).\n\nМожно привезти самому на пункт или изменить вес.`,
  fixVolume: '✏️ Изменить вес',
  askPoint: '🏭 <b>На какой пункт привезёте?</b>',
  pointPaused: '⏸ приём сейчас приостановлен',
  askLocation: '📍 <b>Откуда забрать?</b>\nОтправьте геолокацию кнопкой или напишите адрес.',
  badAddress: '❗️ Напишите адрес подробнее (минимум 5 символов).',
  nearest: (point: string, km: string) => `🏭 Ближайший пункт: <b>${point}</b> (~${km} км)`,
  askPhoto: '📷 <b>Фото макулатуры</b> (необязательно)\nОтправьте фото или пропустите.',
  photoSaved: '✅ Фото получено.',
  photoFail: '⚠️ Фото не сохранилось, продолжаем без него.',
  confirmTitle: '📋 <b>Проверьте заявку</b>',
  sum: { phone: '📱 Телефон', name: '👤 Имя', material: '♻️ Материал', volume: '⚖️ Вес', pickup: '🚚 Способ', location: '📍 Геолокация', address: '📍 Адрес', point: '🏭 Пункт', photo: '📷 Фото', yes: 'есть', no: 'нет', notSet: 'не указано' },
  send: '✅ Отправить',
  restart: '✏️ Заново',
  sent: '✅ Отправлено',
  created: (id: number) => `✅ <b>Заявка #${id} принята!</b>`,
  trackLine: (url: string) => `🔎 Отслеживание: <a href="${url}">${url}</a>`,
  pointLine: (name: string, address: string | null, hours: string, phone: string) =>
    `🏭 Пункт: <b>${name}</b>${address ? `, ${address}` : ''}\n🕒 ${hours} · ☎️ ${phone}`,
  afterCreate: 'Оператор скоро свяжется с вами. Об изменении статуса сообщим здесь.',
  tooMany: '⚠️ У вас уже 5 активных заявок. Сначала завершите или отмените их.',
  errors: {
    phone: '❗️ Неверный телефон.',
    name: '❗️ Неверное имя.',
    point: '❗️ Пока нет активного пункта приёма. Попробуйте позже.',
    min_volume: (min: number) => `❗️ Для вывоза нужно минимум ${min} кг.`,
    location: '❗️ Нужен адрес или геолокация.',
    unknown: '❌ Произошла ошибка. Попробуйте ещё раз.',
  },
  cancelled: '❌ Отменено.',
  flowCancelled: '❌ Заполнение заявки отменено.',
  disputeCancelled: '❌ Отправка комментария отменена. Подтвердить результат можно позже в «📋 Мои заявки».',
  myRequestsTitle: '📋 <b>Мои заявки</b>',
  myRequestsEmpty: '📋 У вас пока нет заявок. Нажмите «♻️ Сдать макулатуру».',
  view: (id: number) => `🔎 #${id}`,
  toList: '📋 К списку',
  cancelReq: '❌ Отменить',
  confirmWeigh: '✅ Подтверждаю',
  disputeWeigh: '❌ Не согласен',
  trackBtn: '🔎 Открыть на сайте',
  notFound: 'Заявка не найдена',
  stale: 'Кнопка устарела',
  cancelledOk: (id: number) => `❌ Заявка #${id} отменена.`,
  cantCancel: 'Водитель уже выехал — для отмены обратитесь к оператору',
  cantCancelWeighed: 'Взвешивание завершено — отменить уже нельзя',
  alreadyFinished: 'Заявка уже завершена или отменена',
  confirmedOk: (id: number) => `🤝 Заявка #${id}: результат подтверждён. Спасибо!`,
  cantDecide: 'Сейчас подтвердить нельзя',
  askDisputeComment: (id: number) => `✍️ Заявка #${id}: с чем вы не согласны? Напишите комментарий.`,
  skipComment: '⏭ Отправить без комментария',
  disputeSent: (id: number) => `⚠️ Заявка #${id}: ваше возражение передано ответственному. Скоро свяжемся.`,
  weighTitle: '⚖️ <b>Результат взвешивания</b>',
  weigh: { actual: 'Фактический вес', discount: 'Скидка', effective: 'Зачтённый вес', price: 'Цена', total: 'Итого' },
  linked: '🔗 Заявка привязана к боту. Теперь уведомления о статусе будут приходить сюда.',
  linkedOther: '⚠️ Эта заявка привязана к другому аккаунту Telegram.',
  pointsTitle: '📍 <b>Пункты приёма</b>',
  pointsEmpty: 'Пока нет активных пунктов.',
  pointsHint: 'Чтобы найти ближайший пункт, отправьте геолокацию 👇',
  hours: '🕒',
  pricesTitle: '💰 <b>Цены (сум/кг)</b>',
  priceLine: (name: string, price: string) => `🏭 ${name}: <b>${price}/кг</b>`,
  minBase: (kg: number) => `📦 Минимум при доставке на пункт: <b>${kg} кг</b>`,
  minPickup: (kg: number) => `🚚 Минимум для вывоза: <b>${kg} кг</b>`,
  priceNote: 'Итоговая сумма считается после взвешивания с учётом качества.',
  contactTitle: '☎️ <b>Контакты</b>',
  contact: { phone: '📞', address: '📍', hours: '🕒', email: '✉️', bot: '🤖' },
  unknown: 'Выберите в меню 👇',
  help: 'ℹ️ <b>Помощь</b>\n/start — главное меню\n/requests — мои заявки\n/help — помощь\n\nВопросы: раздел «☎️ Контакты».',
};

export const T: Record<CustLang, CustTexts> = { uz, ru };

/** Ikkala tildagi menyu tugmalari (hears uchun) */
export const menuTexts = (key: keyof CustTexts['menu']) => [uz.menu[key], ru.menu[key]];
export const BACK_TEXTS = [uz.back, ru.back];
export const CANCEL_TEXTS = [uz.cancel, ru.cancel];
export const SKIP_TEXTS = [uz.skip, ru.skip];
export const SKIP_COMMENT_TEXTS = [uz.skipComment, ru.skipComment];
