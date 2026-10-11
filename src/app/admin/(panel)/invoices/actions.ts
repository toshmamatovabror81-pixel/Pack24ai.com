'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { num } from '@/lib/formData';
import { toNumber } from '@/lib/format';
import { ensureInvoiceForOrder } from '@/lib/documents';
import { afterPaymentChange, writePaymentEvent, type Actor } from '@/lib/orderFlow';
import { notifyCustomerInvoice } from '@/lib/orderNotify';
import { clip } from '@/lib/telegram/api';
import { getSettings } from '@/lib/settings';

const refresh = (id: number, orderId: number) => {
  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath(`/admin/orders/${orderId}`);
};

async function loadInvoice(id: number) {
  // Buyurtma maydonlari: to'lov "to'langan" bo'lganda tarix va xabarnoma (afterPaymentChange) uchun
  const inv = await prisma.corporateInvoice.findUnique({
    where: { id },
    include: { order: { select: { id: true, paymentMethod: true, status: true, paymentStatus: true, totalAmount: true, accessToken: true, telegramUserId: true, contactPhone: true, userId: true } } },
  });
  if (!inv) redirect('/admin/invoices');
  return inv;
}

/** Sahifa ko'rsatgan hisob-faktura holati qulflangan qatordagidan farq qiladi (orada boshqa xodim yozgan): tranzaksiya bekor qilinadi */
class StaleInvoice extends Error {}

/**
 * Hisob-faktura to'lovini yozadi. To'liq to'langanda (`full`) bank o'tkazmali buyurtmaning to'lov holati ham "to'langan" bo'ladi,
 * tarixga yoziladi va mijoz bilan xodimlarga xabar ketadi. Buyurtma shartli yangilanadi: tugma ikki marta bosilsa yoki
 * buyurtma allaqachon to'langan bo'lsa tarix va xabar takrorlanmaydi.
 * Summa va holat sahifa ochilganda o'qilgan `inv` dan hisoblangan: qulflangan qator undan farq qilsa (shu orada boshqa xodim qisman
 * to'lov kiritgan, "to'landi" qilgan yoki belgi bekor qilingan) hech narsa yozilmaydi va 'stale' qaytadi — aks holda ikki moliya xodimi
 * bir vaqtda kiritgan qisman to'lovlardan biri ikkinchisining ustidan yozilib, jimgina yo'qolardi. Xodim yangilangan sahifadan qayta kiritadi.
 */
async function applyPayment(inv: Awaited<ReturnType<typeof loadInvoice>>, data: Prisma.CorporateInvoiceUpdateInput, full: boolean, staffName: string): Promise<'ok' | 'stale'> {
  const actor: Actor = { name: staffName, via: 'invoice' };
  const orderPaid = await prisma
    .$transaction(async (tx) => {
      // Qatorlar orderFlow.setManualPayment bilan bir xil tartibda qulflanadi (avval buyurtma, keyin hisob-faktura): ikki xodim
      // bir vaqtda shu buyurtmani "to'landi" qilsa, baza o'zaro qulflanish (deadlock) deb birini bekor qilmaydi
      const updated = full ? await tx.order.updateMany({ where: { id: inv.orderId, paymentMethod: 'bank_transfer', paymentStatus: { not: 'paid' } }, data: { paymentStatus: 'paid' } }) : null;
      // Hisob-fakturaning yozishdan oldingi holati qulflangan qatordan olinadi: sahifa ko'rsatgan holat bilan solinadi (farq bo'lsa —
      // eskirgan sahifa, tranzaksiya bekor qilinadi) va tarixga aynan shu holat yoziladi
      await tx.$queryRaw`SELECT "id" FROM "CorporateInvoice" WHERE "id" = ${inv.id} FOR UPDATE`;
      const was = await tx.corporateInvoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true, paidAmount: true, paidAt: true } });
      if (was.status !== inv.status || toNumber(was.paidAmount) !== toNumber(inv.paidAmount)) throw new StaleInvoice();
      await tx.corporateInvoice.update({ where: { id: inv.id }, data });
      if (updated?.count !== 1) return false;
      // Buyurtma shu amal bilan "to'langan" bo'ldi: tarixga hisob-fakturaning avvalgi holati bilan yoziladi — to'lov belgisi keyin
      // bekor qilinsa (buyurtma sahifasi yoki bot) hisob-faktura aynan shu holatga qaytadi
      const before = was.status === 'issued' || was.status === 'partial' || was.status === 'overdue' ? [{ id: inv.id, status: was.status, paidAmount: was.paidAmount.toString(), paidAt: was.paidAt?.toISOString() ?? null }] : [];
      await writePaymentEvent(tx, inv.orderId, inv.order.paymentStatus, 'paid', actor, before);
      return true;
    })
    .catch((e: unknown) => {
      if (e instanceof StaleInvoice) return 'stale' as const;
      throw e;
    });
  if (orderPaid === 'stale') return 'stale';
  if (orderPaid) await afterPaymentChange({ ...inv.order, paymentStatus: 'paid' }, inv.order.paymentStatus, actor, { event: false });
  return 'ok';
}

/** Buyurtma sahifasidagi "Hisob-faktura yaratish" tugmasi (mavjud bo'lsa o'shanga o'tadi) */
export async function createInvoiceForOrder(fd: FormData) {
  await requireStaff('finance');
  const orderId = Number(fd.get('orderId'));
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null }, select: { id: true } });
  if (!order) redirect('/admin/orders');
  const raw = num(fd, 'contractId');
  const contract = raw ? await prisma.contract.findUnique({ where: { id: Math.floor(raw) }, select: { id: true } }) : null;
  const { invoice: inv, created } = await ensureInvoiceForOrder(orderId, await getSettings(), contract?.id ?? null);
  // Mijozga faqat yangi yaratilgan hisob-faktura haqida xabar (tugma mavjud hujjatga o'tkazgan bo'lsa — jim). "Yangi"ligini
  // ensureInvoiceForOrder o'z tranzaksiyasida aniqlaydi: alohida tekshiruv ikki marta bosilganda ikkita xabar yuborardi
  if (created) await notifyCustomerInvoice(orderId, inv);
  refresh(inv.id, orderId);
  redirect(`/admin/invoices/${inv.id}`);
}

/** To'liq to'landi: bank o'tkazmali buyurtmaning to'lov holati ham "to'langan" bo'ladi */
export async function markPaid(fd: FormData) {
  const user = await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  if (inv.status === 'cancelled') redirect(`/admin/invoices/${id}?error=state`);
  if ((await applyPayment(inv, { paidAmount: inv.totalAmount, paidAt: new Date(), status: 'paid' }, true, user.name)) === 'stale') redirect(`/admin/invoices/${id}?error=stale`);
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}

/** Qisman to'lov: summa qo'shiladi, jamiga yetsa "to'langan" */
export async function registerPartial(fd: FormData) {
  const user = await requireStaff('finance');
  const id = Number(fd.get('id'));
  const amount = num(fd, 'amount');
  const inv = await loadInvoice(id);
  if (inv.status === 'cancelled' || inv.status === 'paid') redirect(`/admin/invoices/${id}?error=state`);
  if (!amount || amount <= 0) redirect(`/admin/invoices/${id}?error=amount`);
  const total = toNumber(inv.totalAmount);
  const remaining = Math.round((total - toNumber(inv.paidAmount)) * 100) / 100;
  if (amount > remaining) redirect(`/admin/invoices/${id}?error=over`);
  const paidAmount = Math.round((toNumber(inv.paidAmount) + amount) * 100) / 100;
  const paid = paidAmount >= total;
  if ((await applyPayment(inv, { paidAmount, status: paid ? 'paid' : 'partial', ...(paid ? { paidAt: new Date() } : {}) }, paid, user.name)) === 'stale') redirect(`/admin/invoices/${id}?error=stale`);
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}

export async function cancelInvoice(fd: FormData) {
  await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  if (inv.status === 'paid') redirect(`/admin/invoices/${id}?error=state`);
  await prisma.corporateInvoice.update({ where: { id }, data: { status: 'cancelled' } });
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}

/**
 * To'langan hisob-fakturani qayta ochish — buyurtma "to'langan" emas, hisob-faktura esa "to'langan" bo'lib qolgan holatni tuzatish:
 * to'lov shu sahifada xato kiritilgan, yoki buyurtmadagi "to'landi" belgisi bekor qilingan-u, hisob-fakturani u yopmagan edi.
 * Buyurtma "to'langan" yoki "qaytarilgan" turganda bu yerdan ochilmaydi (invoiceStatus.OWED_ORDER bilan bir xil qoida): avval buyurtma
 * «To'lanmagan»ga qaytariladi — u shu belgi yopgan hisob-fakturani avvalgi holatiga o'zi ochadi (bu yerdan ochilsa summa 0 ga tushib,
 * o'sha surat qo'llanmay qolardi); puli qaytarilgan buyurtmaning to'langan hisob-fakturasi esa odatiy yakuniy holat.
 * Oldingi qisman to'lov summasi saqlanmagan, shuning uchun to'langan summa 0 ga qaytadi (sahifada shu aytiladi). Tarixga yoziladi.
 */
export async function reopenInvoice(fd: FormData) {
  const user = await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  const reopened = await prisma.$transaction(async (tx) => {
    // Boshqa to'lov amallari bilan bir xil tartib (avval buyurtma, keyin hisob-faktura): ayni paytda buyurtmani "to'landi" qilayotgan
    // tranzaksiya tugashi kutiladi — busiz pastdagi shart buyurtmaning eski holatini ko'rib, to'langan buyurtmaning hisob-fakturasini
    // ochib yuborardi. NO KEY: boshqa tranzaksiyalarning shu buyurtmaga tarix yozishi (tashqi kalit tekshiruvi) kutib qolmaydi
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${inv.orderId} FOR NO KEY UPDATE`;
    // Shartli yozuv: tugma ikki marta bosilsa yoki shu orada holat o'zgargan bo'lsa hech narsa yozilmaydi
    const updated = await tx.corporateInvoice.updateMany({ where: { id, status: 'paid', order: { paymentStatus: { notIn: ['paid', 'refunded'] } } }, data: { status: 'issued', paidAmount: 0, paidAt: null } });
    if (updated.count !== 1) return false;
    await tx.orderEvent.create({ data: { orderId: inv.orderId, kind: 'invoice', fromValue: 'paid', toValue: 'issued', actor: clip(user.name, 100), via: 'invoice', meta: { invoiceNo: inv.invoiceNo } } });
    return true;
  });
  if (!reopened) redirect(`/admin/invoices/${id}?error=state`);
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}

/** Hisob-fakturani shartnomaga bog'lash (bo'sh tanlov: uzish) */
export async function linkContract(fd: FormData) {
  await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  const raw = num(fd, 'contractId');
  const contract = raw ? await prisma.contract.findUnique({ where: { id: Math.floor(raw) }, select: { id: true, paymentTermDays: true } }) : null;
  // To'lanmagan hisob-fakturada muddat shartnomaning to'lov muddatidan qayta hisoblanadi
  const dueDate = contract && inv.status === 'issued' ? new Date(inv.createdAt.getTime() + contract.paymentTermDays * 86_400_000) : undefined;
  await prisma.corporateInvoice.update({ where: { id }, data: { contractId: contract?.id ?? null, ...(dueDate ? { dueDate } : {}) } });
  revalidatePath('/admin/contracts');
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}
