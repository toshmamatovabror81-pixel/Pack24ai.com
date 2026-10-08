'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { num } from '@/lib/formData';
import { toNumber } from '@/lib/format';
import { ensureInvoiceForOrder } from '@/lib/documents';
import { getSettings } from '@/lib/settings';

const refresh = (id: number, orderId: number) => {
  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath(`/admin/orders/${orderId}`);
};

async function loadInvoice(id: number) {
  const inv = await prisma.corporateInvoice.findUnique({ where: { id }, include: { order: { select: { id: true, paymentMethod: true } } } });
  if (!inv) redirect('/admin/invoices');
  return inv;
}

/** Buyurtma sahifasidagi "Hisob-faktura yaratish" tugmasi (mavjud bo'lsa o'shanga o'tadi) */
export async function createInvoiceForOrder(fd: FormData) {
  await requireStaff('finance');
  const orderId = Number(fd.get('orderId'));
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null }, select: { id: true } });
  if (!order) redirect('/admin/orders');
  const raw = num(fd, 'contractId');
  const contract = raw ? await prisma.contract.findUnique({ where: { id: Math.floor(raw) }, select: { id: true } }) : null;
  const inv = await ensureInvoiceForOrder(orderId, await getSettings(), contract?.id ?? null);
  refresh(inv.id, orderId);
  redirect(`/admin/invoices/${inv.id}`);
}

/** To'liq to'landi: bank o'tkazmali buyurtmaning to'lov holati ham "to'langan" bo'ladi */
export async function markPaid(fd: FormData) {
  await requireStaff('finance');
  const id = Number(fd.get('id'));
  const inv = await loadInvoice(id);
  if (inv.status === 'cancelled') redirect(`/admin/invoices/${id}?error=state`);
  await prisma.$transaction([
    prisma.corporateInvoice.update({ where: { id }, data: { paidAmount: inv.totalAmount, paidAt: new Date(), status: 'paid' } }),
    ...(inv.order.paymentMethod === 'bank_transfer' ? [prisma.order.update({ where: { id: inv.orderId }, data: { paymentStatus: 'paid' } })] : []),
  ]);
  refresh(id, inv.orderId);
  redirect(`/admin/invoices/${id}?saved=1`);
}

/** Qisman to'lov: summa qo'shiladi, jamiga yetsa "to'langan" */
export async function registerPartial(fd: FormData) {
  await requireStaff('finance');
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
  await prisma.$transaction([
    prisma.corporateInvoice.update({ where: { id }, data: { paidAmount, status: paid ? 'paid' : 'partial', ...(paid ? { paidAt: new Date() } : {}) } }),
    ...(paid && inv.order.paymentMethod === 'bank_transfer' ? [prisma.order.update({ where: { id: inv.orderId }, data: { paymentStatus: 'paid' } })] : []),
  ]);
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
