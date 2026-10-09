import type { MaterialType, PickupType, RecyclePaymentStatus, RecycleRequestStatus, VolumeSize } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';

/**
 * Makulatura arizasi holatlari: YAGONA o'tish jadvali. Admin, masul, haydovchi, mijoz va botlar
 * hammasi shu jadval orqali holatni o'zgartiradi (lib/recycling/requests.ts -> transition).
 *
 * new_ -> dispatched (masulga yo'naltirildi) -> assigned (haydovchi tayinlandi) -> en_route -> arrived
 *   -> collecting -> collected (tortildi, hisob yaratildi) -> confirmed (mijoz tasdiqladi) -> completed (to'landi)
 * Istalgan faol holatdan cancelled; collected -> disputed (mijoz inkor qildi) -> completed/cancelled.
 */
export const REQUEST_STATUSES: RecycleRequestStatus[] = [
  'new_', 'dispatched', 'assigned', 'en_route', 'arrived', 'collecting', 'collected', 'confirmed', 'completed', 'cancelled', 'disputed',
];

export const TRANSITIONS: Record<RecycleRequestStatus, RecycleRequestStatus[]> = {
  // -> completed to'g'ridan-to'g'ri: mijoz bazaga o'zi olib keldi (acceptAtBase), haydovchi va tortish hisobi kerak emas
  new_: ['dispatched', 'assigned', 'cancelled', 'completed'],
  dispatched: ['dispatched', 'assigned', 'new_', 'cancelled', 'completed'], // dispatched -> dispatched: boshqa masulga qayta yo'naltirish
  assigned: ['en_route', 'dispatched', 'new_', 'assigned', 'cancelled', 'completed'], // -> dispatched/new_: haydovchi rad etdi; -> assigned: boshqa haydovchi
  en_route: ['arrived', 'assigned', 'dispatched', 'new_', 'cancelled', 'completed'], // -> dispatched/new_: haydovchi yo'lda rad etdi
  arrived: ['collecting', 'collected', 'cancelled'],
  collecting: ['collected', 'cancelled'],
  collected: ['confirmed', 'disputed', 'completed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  disputed: ['collected', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RecycleRequestStatus, to: RecycleRequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Holat o'zgarganda to'ldiriladigan vaqt maydoni */
export const STATUS_TIMESTAMP: Partial<Record<RecycleRequestStatus, 'dispatchedAt' | 'assignedAt' | 'driverEnRouteAt' | 'driverArrivedAt' | 'collectedAt' | 'confirmedAt' | 'completedAt' | 'cancelledAt'>> = {
  dispatched: 'dispatchedAt',
  assigned: 'assignedAt',
  en_route: 'driverEnRouteAt',
  arrived: 'driverArrivedAt',
  collected: 'collectedAt',
  confirmed: 'confirmedAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
};

/** Hali yakunlanmagan (ish jarayonidagi) holatlar */
export const ACTIVE_STATUSES: RecycleRequestStatus[] = ['new_', 'dispatched', 'assigned', 'en_route', 'arrived', 'collecting'];
/** Haydovchi ko'radigan faol topshiriq holatlari */
export const DRIVER_TASK_STATUSES: RecycleRequestStatus[] = ['assigned', 'en_route', 'arrived', 'collecting'];
export const TERMINAL_STATUSES: RecycleRequestStatus[] = ['completed', 'cancelled'];

export const statusLabels: Record<Locale, Record<RecycleRequestStatus, string>> = {
  uz: {
    new_: '🆕 Yangi', dispatched: "📤 Masulga yo'naltirildi", assigned: '👷 Haydovchi tayinlandi', en_route: "🚗 Yo'lda", arrived: '📍 Yetib keldi',
    collecting: "📦 Yig'ilmoqda", collected: '⚖️ Tortildi', confirmed: '🤝 Tasdiqlandi', completed: '🏁 Yakunlandi', cancelled: '❌ Bekor qilindi', disputed: '⚠️ Bahsli',
  },
  ru: {
    new_: '🆕 Новая', dispatched: '📤 Передана ответственному', assigned: '👷 Водитель назначен', en_route: '🚗 В пути', arrived: '📍 Прибыл',
    collecting: '📦 Сбор', collected: '⚖️ Взвешено', confirmed: '🤝 Подтверждено', completed: '🏁 Завершено', cancelled: '❌ Отменено', disputed: '⚠️ Спор',
  },
  en: {
    new_: '🆕 New', dispatched: '📤 Dispatched', assigned: '👷 Driver assigned', en_route: '🚗 On the way', arrived: '📍 Arrived',
    collecting: '📦 Collecting', collected: '⚖️ Weighed', confirmed: '🤝 Confirmed', completed: '🏁 Completed', cancelled: '❌ Cancelled', disputed: '⚠️ Disputed',
  },
};

export const statusTone: Record<RecycleRequestStatus, 'slate' | 'green' | 'amber' | 'red' | 'blue'> = {
  new_: 'red', dispatched: 'amber', assigned: 'blue', en_route: 'blue', arrived: 'blue', collecting: 'blue', collected: 'amber',
  confirmed: 'green', completed: 'green', cancelled: 'slate', disputed: 'red',
};

export const MATERIALS: MaterialType[] = ['karton', 'qogoz', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik'];

export const materialLabels: Record<Locale, Record<MaterialType, string>> = {
  uz: { qogoz: "Qog'oz", karton: 'Karton', gazeta: 'Gazeta', jurnal: 'Jurnal', ofis: "Ofis qog'ozi", kitob: 'Kitob', aralash: 'Aralash makulatura', sellofan: 'Sellofan / plyonka', plastik: 'Plastik (PET)' },
  ru: { qogoz: 'Бумага', karton: 'Картон', gazeta: 'Газеты', jurnal: 'Журналы', ofis: 'Офисная бумага', kitob: 'Книги', aralash: 'Смешанная макулатура', sellofan: 'Плёнка / целлофан', plastik: 'Пластик (ПЭТ)' },
  en: { qogoz: 'Paper', karton: 'Cardboard', gazeta: 'Newspapers', jurnal: 'Magazines', ofis: 'Office paper', kitob: 'Books', aralash: 'Mixed paper', sellofan: 'Film / cellophane', plastik: 'Plastic (PET)' },
};

export const pickupTypeLabels: Record<Locale, Record<PickupType, string>> = {
  uz: { base: "O'zim punktga olib boraman", pickup: 'Mashina chaqiraman (olib ketish)' },
  ru: { base: 'Привезу сам на пункт', pickup: 'Вызвать машину (вывоз)' },
  en: { base: 'I will bring it to the point', pickup: 'Request a pickup' },
};

export const volumeSizeLabels: Record<Locale, Record<VolumeSize, string>> = {
  uz: { small: '📦 Kichik (50 kg gacha)', medium: '📦📦 O\'rta (50–200 kg)', large: '📦📦📦 Katta (200 kg+)' },
  ru: { small: '📦 Мало (до 50 кг)', medium: '📦📦 Средне (50–200 кг)', large: '📦📦📦 Много (200 кг+)' },
  en: { small: '📦 Small (up to 50 kg)', medium: '📦📦 Medium (50–200 kg)', large: '📦📦📦 Large (200 kg+)' },
};

export const paymentStatusLabels: Record<RecyclePaymentStatus, string> = {
  pending: "⏳ To'lov kutilmoqda", paid_to_driver: "💵 Haydovchiga to'landi", paid_to_customer: "💵 Mijozga to'landi", paid_both: '💵 Ikkalasiga', completed: "✅ To'landi",
};

/** Taxminiy hajm (kg) dan VolumeSize */
export function volumeSizeFromKg(kg: number | null | undefined): VolumeSize | null {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return null;
  return kg <= 50 ? 'small' : kg <= 200 ? 'medium' : 'large';
}

export function isRequestStatus(v: unknown): v is RecycleRequestStatus {
  return typeof v === 'string' && (REQUEST_STATUSES as string[]).includes(v);
}

export function isMaterial(v: unknown): v is MaterialType {
  return typeof v === 'string' && (MATERIALS as string[]).includes(v);
}
