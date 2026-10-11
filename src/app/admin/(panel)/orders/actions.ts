'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { requireStaff } from '@/lib/auth';
import { changeOrderStatus, setManualPayment, type Actor } from '@/lib/orderFlow';

const PAYMENTS = ['pending', 'paid', 'refunded'] as const;

/**
 * Buyurtma sahifasidagi forma. Vaqt belgilari, ombordan chiqim, tarix va mijozga Telegram xabari orderFlow ichida —
 * boshqaruv boti ham aynan shu funksiyalarni chaqiradi, shuning uchun natija bir xil.
 */
export async function updateOrder(fd: FormData) {
  const user = await requireStaff('orders');
  const id = Number(fd.get('id'));
  if (!Number.isSafeInteger(id)) redirect('/admin/orders');
  const actor: Actor = { name: user.name, via: 'admin' };
  // Forma ochiq turganda holatni bot yoki boshqa xodim o'zgartirgan bo'lishi mumkin: faqat shu xodim o'zi o'zgartirgan maydon
  // qo'llanadi, aks holda eski qiymat qaytib yozilib, mijozga noto'g'ri xabar ketardi (prev* maydonlari bo'lmasa — har doim qo'llanadi)
  const touched = (name: string, prev: string) => fd.get(prev) === null || fd.get(name) !== fd.get(prev);
  // Xodim o'zgartirgan maydon ham eskirgan bo'lishi mumkin: u "Yangi" deb ko'rgan buyurtmani bot allaqachon "Yo'lda" qilgan bo'lsa,
  // "Tayyorlanmoqda" ni saqlash buyurtmani orqaga qaytarib, mijozga teskari xabar yuborardi. Shuning uchun forma ko'rsatgan qiymat
  // (prev*) orderFlow'ga "kutilgan qiymat" bo'lib beriladi: bazadagi qiymat undan farq qilsa yozilmaydi ("conflict") va xodim
  // ogohlantiriladi (yangilangan sahifada istalgan holatni qayta tanlay oladi). Tekshiruv orderFlow ichida, shartli yozuv bilan birga.
  const seen = (prev: string) => {
    const v = fd.get(prev);
    return typeof v === 'string' ? { expected: v } : null;
  };
  let conflict = false;
  let delivered = false;

  if (touched('status', 'prevStatus')) {
    // Admin formasi istalgan holatni qo'ya oladi (tuzatish uchun), shuning uchun enforceFlow yo'q
    const next = String(fd.get('status')) as OrderStatus;
    const base = seen('prevStatus');
    const res = base ? await changeOrderStatus(id, next, actor, base) : await changeOrderStatus(id, next, actor);
    if (!res.ok && res.reason === 'not_found') redirect('/admin/orders');
    if (!res.ok && res.reason === 'conflict') conflict = true;
    delivered = res.ok && res.changed && res.order.status === 'delivered';
  }

  // Onlayn to'lov holatini Payme/Click o'zi o'zgartiradi; qo'lda faqat naqd va bank o'tkazmasi (setManualPayment o'zi tekshiradi)
  const payment = PAYMENTS.find((p) => p === fd.get('paymentStatus'));
  if (payment && touched('paymentStatus', 'prevPaymentStatus')) {
    const base = seen('prevPaymentStatus');
    const res = base ? await setManualPayment(id, payment, actor, base) : await setManualPayment(id, payment, actor);
    if (!res.ok && res.reason === 'not_found') redirect('/admin/orders');
    if (!res.ok && res.reason === 'conflict') conflict = true;
  }

  if (delivered) revalidatePath('/admin/inventory');
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?${conflict ? 'error=conflict' : 'saved=1'}`);
}
