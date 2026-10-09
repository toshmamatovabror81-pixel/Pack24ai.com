'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { text } from '@/lib/formData';
import { settleWithdrawal, WalletError } from '@/lib/recycling/wallet';
import { markOwnEventsProcessed } from '../events/audit';
import { financeUrl, PERIOD_KEYS, type PeriodKey } from './period';

/** Moliya: haydovchi yechib olish so'rovlarini to'landi / rad etish (admin nomidan) */

const BASE = '/admin/recycling/finance';

function backOf(fd: FormData) {
  const key: PeriodKey = PERIOD_KEYS.find((k) => k === fd.get('period')) ?? 'today';
  const pid = Number(fd.get('point'));
  return { key, fromStr: text(fd, 'from', 10), toStr: text(fd, 'to', 10), pointId: Number.isSafeInteger(pid) && pid > 0 ? pid : null };
}

async function settle(fd: FormData, status: 'completed' | 'failed') {
  const user = await requireStaff('recycling');
  const id = Number(fd.get('id'));
  const back = backOf(fd);
  let extra: Record<string, string> = { saved: '1' };
  try {
    if (!Number.isSafeInteger(id) || id <= 0) throw new WalletError('not_found', "So'rov topilmadi");
    const t = await settleWithdrawal(id, status, { name: user.name });
    // Adminning o'z amali — hodisa «ko'rilgan»
    await markOwnEventsProcessed({ driverId: t.driverId, eventType: [status === 'completed' ? 'withdrawal_paid' : 'withdrawal_rejected'] });
  } catch (e) {
    extra = { error: e instanceof WalletError ? e.message : "Xato yuz berdi. Qayta urinib ko'ring" };
    if (!(e instanceof WalletError)) console.error('[admin/finance]', e);
  }
  revalidatePath(BASE);
  redirect(financeUrl(back, extra));
}

export async function payWithdrawalAction(fd: FormData) {
  await settle(fd, 'completed');
}

export async function rejectWithdrawalAction(fd: FormData) {
  await settle(fd, 'failed');
}
