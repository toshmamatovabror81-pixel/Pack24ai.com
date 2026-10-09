import 'server-only';
import { Prisma, type CardType, type DriverCard, type DriverTransaction } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/format';
import { logEvent } from './events';
import { notifyDriver, notifyHqAdmins, notifySupervisor } from '@/lib/telegram/notify';
import { esc } from '@/lib/telegram/api';

/** Haydovchi hamyoni: daromad (earning/bonus, completed) − yechib olish (withdrawal, pending yoki completed). */

export const MIN_WITHDRAWAL = 20_000;

export class WalletError extends Error {
  constructor(public code: 'amount' | 'balance' | 'card' | 'not_found' | 'status', message: string) {
    super(message);
  }
}

export async function driverBalance(driverId: number, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<{ earned: number; withdrawn: number; pending: number; balance: number }> {
  const [earn, done, pend] = await Promise.all([
    tx.driverTransaction.aggregate({ where: { driverId, type: { in: ['earning', 'bonus'] }, status: 'completed' }, _sum: { amount: true } }),
    tx.driverTransaction.aggregate({ where: { driverId, type: 'withdrawal', status: 'completed' }, _sum: { amount: true } }),
    tx.driverTransaction.aggregate({ where: { driverId, type: 'withdrawal', status: 'pending' }, _sum: { amount: true } }),
  ]);
  const earned = toNumber(earn._sum.amount);
  const withdrawn = toNumber(done._sum.amount);
  const pending = toNumber(pend._sum.amount);
  return { earned, withdrawn, pending, balance: Math.round(earned - withdrawn - pending) };
}

export function driverTransactions(driverId: number, limit = 50): Promise<(DriverTransaction & { card: DriverCard | null })[]> {
  return prisma.driverTransaction.findMany({ where: { driverId }, include: { card: true }, orderBy: { id: 'desc' }, take: limit });
}

/** Yechib olish so'rovi: balans yetarli bo'lsa `pending`; masul/HQ tasdiqlaydi (settleWithdrawal). cash=true — kartasiz, naqd. */
export async function requestWithdrawal(driverId: number, amount: number, cardId?: number | null, opts: { cash?: boolean } = {}): Promise<DriverTransaction> {
  const sum = Math.round(Number(amount) || 0);
  if (sum < MIN_WITHDRAWAL) throw new WalletError('amount', `Kamida ${MIN_WITHDRAWAL.toLocaleString('ru-RU')} so'm`);
  const trx = await prisma.$transaction(async (tx) => {
    const { balance } = await driverBalance(driverId, tx);
    if (sum > balance) throw new WalletError('balance', `Balans yetarli emas: ${balance.toLocaleString('ru-RU')} so'm`);
    let card: DriverCard | null = null;
    if (cardId) {
      card = await tx.driverCard.findFirst({ where: { id: cardId, driverId, isActive: true } });
      if (!card) throw new WalletError('card', 'Karta topilmadi');
    } else if (!opts.cash) {
      card = await tx.driverCard.findFirst({ where: { driverId, isActive: true }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
    }
    return tx.driverTransaction.create({ data: { driverId, type: 'withdrawal', amount: sum, status: 'pending', cardId: card?.id ?? null, description: card ? `Kartaga: ${card.cardNumber}` : 'Naqd' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const d = await prisma.driver.findUnique({ where: { id: driverId }, include: { supervisor: true } });
  await logEvent({ sourceBot: 'driver', eventType: 'withdrawal_requested', title: `Yechib olish so'rovi: ${sum.toLocaleString('ru-RU')} so'm`, message: d?.name ?? '', driverId, supervisorId: d?.supervisorId ?? null, pointId: d?.pointId ?? null });
  const text = `💳 <b>Yechib olish so'rovi</b>\nHaydovchi: ${esc(d?.name ?? '')}\nSumma: <b>${sum.toLocaleString('ru-RU')} so'm</b>\n${esc(trx.description ?? '')}`;
  const kb = [[{ text: "✅ To'landi", callback_data: `wd_ok_${trx.id}` }, { text: '❌ Rad', callback_data: `wd_no_${trx.id}` }]];
  if (d?.supervisor?.telegramId) await notifySupervisor(d.supervisor.telegramId, text, kb);
  else await notifyHqAdmins(text, kb);
  return trx;
}

/** Masul/HQ/admin: so'rov to'landi yoki rad etildi. Masul faqat o'z haydovchisi yoki o'z punkti haydovchisi so'rovini yopadi. */
export async function settleWithdrawal(txId: number, status: 'completed' | 'failed', by: { name: string; supervisorId?: number }): Promise<DriverTransaction> {
  const t = await prisma.driverTransaction.findUnique({ where: { id: txId }, include: { driver: true } });
  if (!t || t.type !== 'withdrawal') throw new WalletError('not_found', "So'rov topilmadi");
  if (t.status !== 'pending') throw new WalletError('status', "So'rov allaqachon ko'rib chiqilgan");
  if (by.supervisorId && t.driver.supervisorId !== by.supervisorId) {
    const sup = await prisma.supervisor.findUnique({ where: { id: by.supervisorId }, select: { pointId: true } });
    if (!sup?.pointId || t.driver.pointId !== sup.pointId) throw new WalletError('not_found', 'Bu haydovchi sizning punktingizda emas');
  }
  const updated = await prisma.driverTransaction.update({ where: { id: txId }, data: { status, metadata: { settledBy: by.name, settledAt: new Date().toISOString() } } });
  await logEvent({ sourceBot: by.supervisorId ? 'supervisor' : 'platform', eventType: status === 'completed' ? 'withdrawal_paid' : 'withdrawal_rejected', severity: status === 'completed' ? 'success' : 'warning', title: `Yechib olish ${status === 'completed' ? "to'landi" : 'rad etildi'}: ${toNumber(t.amount).toLocaleString('ru-RU')} so'm`, message: `${t.driver.name} · ${by.name}`, driverId: t.driverId, supervisorId: t.driver.supervisorId });
  if (t.driver.telegramId) {
    await notifyDriver(t.driver.telegramId, status === 'completed' ? `✅ ${toNumber(t.amount).toLocaleString('ru-RU')} so'm to'landi.` : `❌ ${toNumber(t.amount).toLocaleString('ru-RU')} so'm so'rovi rad etildi. Masul bilan bog'laning.`);
  }
  return updated;
}

export async function addBonus(driverId: number, amount: number, description: string, by: string): Promise<DriverTransaction> {
  const sum = Math.round(Number(amount) || 0);
  if (sum <= 0) throw new WalletError('amount', "Summa 0 dan katta bo'lsin");
  const t = await prisma.driverTransaction.create({ data: { driverId, type: 'bonus', amount: sum, status: 'completed', description: description.slice(0, 200) || 'Bonus', metadata: { by } } });
  const d = await prisma.driver.findUnique({ where: { id: driverId }, select: { telegramId: true } });
  if (d?.telegramId) await notifyDriver(d.telegramId, `🎁 Bonus: <b>${sum.toLocaleString('ru-RU')} so'm</b> — ${esc(description)}`);
  return t;
}

// ─── Kartalar ────────────────────────────────────────────────────────────────

export function cardTypeFromNumber(digits: string): CardType {
  if (digits.startsWith('8600') || digits.startsWith('5614')) return 'uzcard';
  if (digits.startsWith('9860')) return 'humo';
  if (digits.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';
  return 'other';
}

export const maskCard = (digits: string) => `**** **** **** ${digits.slice(-4)}`;

/** Karta raqamining to'liq ko'rinishi hech qachon saqlanmaydi — faqat oxirgi 4 raqam */
export async function addCard(driverId: number, input: { number: string; holder: string; expiryMonth: number; expiryYear: number; isDefault?: boolean }): Promise<DriverCard> {
  const digits = input.number.replace(/\D/g, '');
  if (digits.length !== 16) throw new WalletError('card', "Karta raqami 16 ta raqam bo'lsin");
  const month = Math.floor(input.expiryMonth);
  const year = Math.floor(input.expiryYear) < 100 ? 2000 + Math.floor(input.expiryYear) : Math.floor(input.expiryYear);
  if (month < 1 || month > 12 || year < 2024 || year > 2060) throw new WalletError('card', "Amal qilish muddati noto'g'ri");
  const holder = input.holder.trim().slice(0, 100);
  if (holder.length < 2) throw new WalletError('card', 'Karta egasi ismi kerak');
  return prisma.$transaction(async (tx) => {
    const masked = maskCard(digits);
    const dup = await tx.driverCard.findFirst({ where: { driverId, isActive: true, cardNumber: masked, expiryMonth: month, expiryYear: year } });
    if (dup) throw new WalletError('card', "Bu karta allaqachon qo'shilgan");
    const count = await tx.driverCard.count({ where: { driverId, isActive: true } });
    const isDefault = input.isDefault || count === 0;
    if (isDefault) await tx.driverCard.updateMany({ where: { driverId }, data: { isDefault: false } });
    return tx.driverCard.create({ data: { driverId, cardNumber: masked, cardHolder: holder, expiryMonth: month, expiryYear: year, cardType: cardTypeFromNumber(digits), isDefault } });
  });
}

export async function removeCard(driverId: number, cardId: number): Promise<void> {
  await prisma.driverCard.updateMany({ where: { id: cardId, driverId }, data: { isActive: false, isDefault: false } });
}

export const driverCards = (driverId: number) => prisma.driverCard.findMany({ where: { driverId, isActive: true }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
