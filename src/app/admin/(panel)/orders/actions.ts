'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';

const STATUSES: OrderStatus[] = ['new_', 'processing', 'shipping', 'delivered', 'cancelled'];
const PAYMENTS: PaymentStatus[] = ['pending', 'paid', 'refunded'];

export async function updateOrder(fd: FormData) {
  await requireStaff('orders');
  const id = Number(fd.get('id'));
  const status = String(fd.get('status')) as OrderStatus;
  const paymentStatus = String(fd.get('paymentStatus')) as PaymentStatus;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) redirect('/admin/orders');
  const data: Parameters<typeof prisma.order.update>[0]['data'] = {};
  if (STATUSES.includes(status) && status !== order.status) {
    data.status = status;
    const now = new Date();
    if (status === 'processing' && !order.confirmedAt) data.confirmedAt = now;
    if (status === 'shipping' && !order.shippedAt) data.shippedAt = now;
    if (status === 'delivered' && !order.deliveredAt) data.deliveredAt = now;
    if (status === 'cancelled' && !order.cancelledAt) data.cancelledAt = now;
  }
  // Onlayn to'lov holatini Payme/Click o'zi o'zgartiradi; qo'lda faqat naqd va bank o'tkazmasi
  const manualPayment = order.paymentMethod === 'cash' || order.paymentMethod === 'bank_transfer' || !order.paymentMethod;
  if (manualPayment && PAYMENTS.includes(paymentStatus) && paymentStatus !== order.paymentStatus) data.paymentStatus = paymentStatus;
  if (Object.keys(data).length) await prisma.order.update({ where: { id }, data });
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?saved=1`);
}
