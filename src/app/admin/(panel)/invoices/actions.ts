'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { num } from '@/lib/formData';
import { toNumber } from '@/lib/format';
import { ensureInvoiceForOrder } from '@/lib/documents';
import { afterPaymentChange } from '@/lib/orderFlow';
import { notifyCustomerInvoice } from '@/lib/orderNotify';
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

/**
 * Hisob-faktura to'lovini yozadi. To'liq to'langanda (`full`) bank o'tkazmali buyurtmaning to'lov holati ham "to'langan" bo'ladi,
 * tarixga yoziladi va mijoz bilan xodimlarga xabar ketadi. Buyurtma shartli yangilanadi: tugma ikki marta bosilsa yoki
 * buyurtma allaqachon to'langan bo'lsa tarix va xabar takrorlanmaydi.
 */
async function applyPayment(inv: Awaited<ReturnType<typeof loadInvoice>>, data: Prisma.CorporateInvoiceUpdateInput, full: boolean, staffName: string) {
  const orderPaid = await prisma.$transaction(async (tx) => {
    // Qatorlar orderFlow.setManualPayment bilan bir xil tartibda qulflanadi (avval buyurtma, keyin hisob-faktura): ikki xodim
    // bir vaqtda shu buyurtmani "to'landi" qilsa, baza o'zaro qulflanish (deadlock) deb birini bekor qilmaydi
    const updated = full ? await tx.order.updateMany({ where: { id: inv.orderId, paymentMethod: 'bank_transfer', paymentStatus: { not: 'paid' } }, data: { paymentStatus: 'paid' } }) : null;
    await tx.corporateInvoice.update({ where: { id: inv.id }, data });
    return updated?.count === 1;
  });
  if (orderPaid) await afterPaymentChange({ ...inv.order, paymentStatus: 'paid' }, inv.order.paymentStatus, { name: staffName, via: 'invoice' });
}

/** Buyurtma sahifasidagi "Hisob-faktura yaratish" tugmasi (mavjud bo'lsa o'shanga o'tadi) */
export async function createInvoiceForOrder(fd: FormData) {
  await requireStaff('finance');
  const orderId = Number(fd.get('orderId'));
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null }, select: { id: true } });
  if (!order) redirect('/admin/orders');
  const raw = num(fd, 'contractId');
  const contract = raw ? await prisma.contract.findUnique({ where: { id: Math.floor(raw) }, select: { id: true } }) : null;
  const existing = await prisma.corporateInvoice.findFirst({ where: { orderId, status: { not: 'cancelled' } }, select: { id: true } });
  const inv = await ensureInvoiceForOrder(orderId, await getSettings(), contract?.id ?? null);
  // Mijozga faqat yangi yaratilgan hisob-faktura haqida xabar (tugma mavjud hujjatga o'tkazgan bo'lsa — jim)
  if (!existing) await notifyCustomerInvoice(orderId, inv);
  refresh(inv.id, orderId);
  redirect(`/admin/invoices/${inv.id}`);
}

/** To'liq to'landi: bank o'tkazmali buyurtmaning to'lov holati ham "to'langan" bo'ladi */
export async function markPaid(fd: FormData) {
  const user = await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  if (inv.status === 'cancelled') redirect(`/admin/invoices/${id}?error=state`);
  await applyPayment(inv, { paidAmount: inv.totalAmount, paidAt: new Date(), status: 'paid' }, true, user.name);
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
  await applyPayment(inv, { paidAmount, status: paid ? 'paid' : 'partial', ...(paid ? { paidAt: new Date() } : {}) }, paid, user.name);
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
