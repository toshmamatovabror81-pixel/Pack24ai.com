'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ContractStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { date, num, optText, text } from '@/lib/formData';
import { normalizePhone } from '@/lib/format';
import { nextContractNo } from '@/lib/documents';

const STATUSES: ContractStatus[] = ['active', 'suspended', 'closed'];

export async function saveContract(fd: FormData) {
  await requireStaff('finance');
  const id = Number(fd.get('id')) || null;
  const back = id ? `/admin/contracts/${id}` : '/admin/contracts/new';
  const companyName = text(fd, 'companyName', 200);
  if (!companyName) redirect(`${back}?error=company`);
  const inn = text(fd, 'inn', 20).replace(/\s/g, '');
  if (inn && !/^\d{9,14}$/.test(inn)) redirect(`${back}?error=inn`);
  const userRaw = num(fd, 'userId');
  const user = userRaw ? await prisma.user.findFirst({ where: { id: Math.floor(userRaw), role: 'user', deletedAt: null }, select: { id: true } }) : null;
  const rawPhone = text(fd, 'phone', 30);
  const status = STATUSES.find((s) => s === fd.get('status')) ?? 'active';
  const data = {
    companyName,
    inn: inn || null,
    directorName: optText(fd, 'directorName', 120),
    address: optText(fd, 'address', 300),
    phone: rawPhone ? (normalizePhone(rawPhone) ?? rawPhone) : null,
    bankName: optText(fd, 'bankName', 120),
    mfo: optText(fd, 'mfo', 10),
    bankAccount: optText(fd, 'bankAccount', 40),
    creditLimit: Math.max(0, num(fd, 'creditLimit') ?? 0),
    paymentTermDays: Math.max(0, Math.floor(num(fd, 'paymentTermDays') ?? 15)),
    status,
    endDate: date(fd, 'endDate'),
    notes: optText(fd, 'notes', 2000),
    userId: user?.id ?? null,
  };
  const startDate = date(fd, 'startDate');
  const saved = id
    ? await prisma.contract.update({ where: { id }, data: { ...data, ...(startDate ? { startDate } : {}) } })
    : await prisma.contract.create({ data: { ...data, contractNo: await nextContractNo(), startDate: startDate ?? new Date() } });
  revalidatePath('/admin/contracts');
  revalidatePath(`/admin/contracts/${saved.id}`);
  redirect(`/admin/contracts/${saved.id}?saved=1`);
}
