'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { num, optText, text } from '@/lib/formData';
import { Prisma } from '@prisma/client';
import { addExpense, addIntake, addPress, addSale, dateKey, dateLabel, JournalError, journalKindLabels, parseJournalDate, setDailyCash, type JournalKind } from '@/lib/recycling/journal';
import { adminEvent } from '../events/audit';
import { dayUrl, type JournalScope } from './shared';

/**
 * Admin: masul kunlik jurnalini tahrirlash. Qo'shish — poydevor funksiyalari (addIntake va h.k.),
 * tahrir/o'chirish — prisma bilan to'g'ridan-to'g'ri (totalAmount qayta hisoblanadi, sana ham o'zgartiriladi).
 * Har amal hodisalar jurnaliga «ko'rilgan» holatda yoziladi (adminning o'z ishi hisoblagichni shishirmaydi).
 */

const KINDS: JournalKind[] = ['intake', 'press', 'expense', 'sales', 'cash'];

const idOf = (fd: FormData, name: string): number => {
  const n = Number(fd.get(name));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};
const kindOf = (fd: FormData): JournalKind | null => KINDS.find((k) => k === fd.get('kind')) ?? null;

/** Sahifadagi ko'rinish (masul yoki punkt) — qaytish manzili uchun */
function scopeOf(fd: FormData): JournalScope | null {
  const sid = idOf(fd, 'scopeSupervisorId');
  if (sid) return { supervisorId: sid };
  const pid = idOf(fd, 'scopePointId');
  return pid ? { pointId: pid } : null;
}

function errMsg(e: unknown): string {
  if (e instanceof JournalError) return e.message;
  console.error('[admin/journal]', e);
  return "Xato yuz berdi. Qayta urinib ko'ring";
}

/** 0 yoki undan katta son; bo'sh/noto'g'ri bo'lsa xato */
const pos = (v: number | null, label: string): number => {
  if (v == null || !Number.isFinite(v) || v < 0) throw new JournalError('value', `${label} noto'g'ri`);
  return v;
};

async function finish(scope: JournalScope | null, date: Date | null, extra: Record<string, string>): Promise<never> {
  revalidatePath('/admin/recycling/journal');
  revalidatePath('/admin/recycling/journal/day');
  if (!scope) redirect('/admin/recycling/journal');
  redirect(dayUrl(scope, dateKey(date ?? new Date()), extra));
}

async function audit(eventType: string, title: string, message: string, supervisorId: number | null) {
  const s = supervisorId ? await prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { pointId: true } }) : null;
  await adminEvent({ eventType, title, message, supervisorId, pointId: s?.pointId ?? null });
}

/** Tahrir formasidagi sana (bo'sh bo'lsa o'zgarmaydi); noto'g'ri bo'lsa xato */
function editDate(fd: FormData): Date | undefined {
  const raw = text(fd, 'date', 20);
  if (!raw) return undefined;
  const d = parseJournalDate(raw);
  if (!d) throw new JournalError('date', "Sana noto'g'ri (YYYY-MM-DD yoki DD.MM.YYYY)");
  return d;
}

export async function addEntryAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const scope = scopeOf(fd);
  const pageDate = parseJournalDate(text(fd, 'scopeDate', 20));
  const kind = kindOf(fd);
  const supervisorId = idOf(fd, 'supervisorId');
  const date = parseJournalDate(text(fd, 'date', 20));
  if (!kind) return finish(scope, pageDate, { error: "Yozuv turi noto'g'ri" });
  try {
    if (!supervisorId) throw new JournalError('supervisor', 'Masulni tanlang');
    if (!date) throw new JournalError('date', "Sana noto'g'ri (YYYY-MM-DD yoki DD.MM.YYYY)");
    if (kind === 'intake') await addIntake(supervisorId, { date, weightKg: num(fd, 'weightKg') ?? NaN, pricePerKg: num(fd, 'pricePerKg') ?? NaN, note: optText(fd, 'note', 300) });
    else if (kind === 'press') await addPress(supervisorId, { date, pressedKg: num(fd, 'pressedKg') ?? NaN, baleCount: num(fd, 'baleCount') ?? 0, operators: optText(fd, 'operators', 200), note: optText(fd, 'note', 300) });
    else if (kind === 'expense') await addExpense(supervisorId, { date, expenseAmount: num(fd, 'expenseAmount') ?? 0, advanceAmount: num(fd, 'advanceAmount') ?? 0, comment: optText(fd, 'comment', 300) });
    else if (kind === 'sales') await addSale(supervisorId, { date, customerName: text(fd, 'customerName', 150), weightKg: num(fd, 'weightKg') ?? NaN, baleCount: num(fd, 'baleCount') ?? 0, pricePerKg: num(fd, 'pricePerKg') ?? NaN, vehicleType: optText(fd, 'vehicleType', 60), plateNumber: optText(fd, 'plateNumber', 20), note: optText(fd, 'note', 300) });
    else await setDailyCash(supervisorId, { date, openingBalance: num(fd, 'openingBalance') ?? NaN, note: optText(fd, 'note', 300) });
    await audit('journal_admin_add', `Jurnal: ${journalKindLabels[kind]} qo'shildi (${dateLabel(date)})`, `Admin: ${user.name}`, supervisorId);
  } catch (e) {
    return finish(scope, date ?? pageDate, { error: errMsg(e) });
  }
  // Yangi yozuv sanasiga o'tamiz (sahifa sanasidan farq qilishi mumkin)
  return finish(scope, date, { saved: '1' });
}

export async function updateEntryAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const scope = scopeOf(fd);
  const pageDate = parseJournalDate(text(fd, 'scopeDate', 20));
  const kind = kindOf(fd);
  const id = idOf(fd, 'id');
  if (!kind || !id) return finish(scope, pageDate, { error: 'Yozuv topilmadi' });
  let supervisorId: number | null = null;
  let movedTo: Date | null = null;
  try {
    const date = editDate(fd);
    let r: { supervisorId: number; date: Date };
    if (kind === 'intake') {
      const weightKg = pos(num(fd, 'weightKg'), "Og'irlik");
      const pricePerKg = pos(num(fd, 'pricePerKg'), 'Narx');
      r = await prisma.recycleManualIntake.update({ where: { id }, data: { date, weightKg, pricePerKg, totalAmount: Math.round(weightKg * pricePerKg), note: optText(fd, 'note', 300) } });
    } else if (kind === 'press') {
      r = await prisma.recyclePressLog.update({ where: { id }, data: { date, pressedKg: pos(num(fd, 'pressedKg'), "Og'irlik"), baleCount: Math.floor(pos(num(fd, 'baleCount') ?? 0, 'Toylar soni')), operators: optText(fd, 'operators', 200), note: optText(fd, 'note', 300) } });
    } else if (kind === 'expense') {
      const expenseAmount = pos(num(fd, 'expenseAmount') ?? 0, 'Xarajat');
      const advanceAmount = pos(num(fd, 'advanceAmount') ?? 0, 'Avans');
      if (!expenseAmount && !advanceAmount) throw new JournalError('value', 'Xarajat yoki avans summasi kerak');
      r = await prisma.recycleExpenseLog.update({ where: { id }, data: { date, expenseAmount, advanceAmount, comment: optText(fd, 'comment', 300) } });
    } else if (kind === 'sales') {
      const weightKg = pos(num(fd, 'weightKg'), "Og'irlik");
      const pricePerKg = pos(num(fd, 'pricePerKg'), 'Narx');
      const customerName = text(fd, 'customerName', 150);
      if (customerName.length < 2) throw new JournalError('value', 'Xaridor nomi kerak');
      r = await prisma.recycleSalesLog.update({
        where: { id },
        data: { date, customerName, weightKg, pricePerKg, totalAmount: Math.round(weightKg * pricePerKg), baleCount: Math.floor(pos(num(fd, 'baleCount') ?? 0, 'Toylar')), vehicleType: optText(fd, 'vehicleType', 60), plateNumber: optText(fd, 'plateNumber', 20), note: optText(fd, 'note', 300) },
      });
    } else {
      // Kassa: masul + sana yagona — boshqa kunda allaqachon bo'lsa P2002
      r = await prisma.recycleDailyCash
        .update({ where: { id }, data: { date, openingBalance: pos(num(fd, 'openingBalance'), 'Ochilish summasi'), note: optText(fd, 'note', 300) } })
        .catch((e: unknown) => {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new JournalError('date', 'Bu masul uchun shu kunda kassa ochilishi allaqachon bor — o\'sha qatorni tahrirlang');
          throw e;
        });
    }
    supervisorId = r.supervisorId;
    // Boshqa kunga ko'chirildimi (sahifa kunidan farq qilsa)
    if (pageDate && date && dateKey(date) !== dateKey(pageDate)) movedTo = date;
    await audit('journal_admin_edit', `Jurnal: ${journalKindLabels[kind]} #${id} tahrirlandi (${dateLabel(r.date)})`, `Admin: ${user.name}`, supervisorId);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return finish(scope, pageDate, { error: 'Yozuv topilmadi (allaqachon o\'chirilgan)' });
    return finish(scope, pageDate, { error: errMsg(e) });
  }
  return finish(scope, pageDate, movedTo ? { saved: '1', moved: dateKey(movedTo) } : { saved: '1' });
}

export async function deleteEntryAction(fd: FormData) {
  const user = await requireStaff('recycling');
  const scope = scopeOf(fd);
  const pageDate = parseJournalDate(text(fd, 'scopeDate', 20));
  const kind = kindOf(fd);
  const id = idOf(fd, 'id');
  if (!kind || !id) return finish(scope, pageDate, { error: 'Yozuv topilmadi' });
  try {
    const where = { where: { id } };
    const r =
      kind === 'intake' ? await prisma.recycleManualIntake.delete(where)
        : kind === 'press' ? await prisma.recyclePressLog.delete(where)
          : kind === 'expense' ? await prisma.recycleExpenseLog.delete(where)
            : kind === 'sales' ? await prisma.recycleSalesLog.delete(where)
              : await prisma.recycleDailyCash.delete(where);
    await audit('journal_admin_delete', `Jurnal: ${journalKindLabels[kind]} #${id} o'chirildi (${dateLabel(r.date)})`, `Admin: ${user.name}`, r.supervisorId);
  } catch (e) {
    return finish(scope, pageDate, { error: errMsg(e) });
  }
  return finish(scope, pageDate, { saved: '1' });
}
