import 'server-only';
import { settleWithin } from '@/lib/background';
import { afterPaymentChange } from '@/lib/orderFlow';

/**
 * Payme va Click webhook'lari uchun: to'lov holati o'zgargach tarix va Telegram xabarlari (mijozga, xodimlarga).
 * To'lov tizimi javobni uzoq kutmaydi, shuning uchun ko'pi bilan 4 s kutiladi — Telegram sekin bo'lsa ish fonda tugaydi;
 * bu yerdagi xato to'lov tizimiga beriladigan javobni hech qachon buzmaydi.
 */
export async function recordPayment(...args: Parameters<typeof afterPaymentChange>): Promise<void> {
  // Xato shu yerda, qaysi to'lov tizimi va qaysi buyurtma ekani bilan yoziladi (settleWithin faqat kutish muddatini cheklaydi)
  await settleWithin(afterPaymentChange(...args).catch((e) => console.error(`${args[2].name}: tarix/xabarnoma`, args[0].id, e)), 4_000);
}
