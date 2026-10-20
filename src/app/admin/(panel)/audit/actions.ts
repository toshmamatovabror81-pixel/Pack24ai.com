'use server';

import { redirect } from 'next/navigation';
import { runAudit } from '@/lib/ai/audit';
import { requireStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';

const MIN_GAP_MS = 60_000;
/** Tekshiruv ketayotgan payt (hisobot hali saqlanmagan): ikkinchi bosish yangi tekshiruv va yangi AI so'rovini boshlamaydi */
let running = false;

/** «Hozir tekshirish»: daqiqasiga bir martadan ko'p emas — har bir tekshiruv AI so'rovi (pul) va o'nlab baza so'rovlari */
export async function runAuditNow() {
  await requireStaff('reports');
  const last = await prisma.auditReport.findFirst({ orderBy: { id: 'desc' }, select: { createdAt: true } });
  if (running || (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MS)) redirect('/admin/audit?wait=1');
  running = true;
  let id: number;
  try {
    id = (await runAudit('manual')).id;
  } finally {
    running = false;
  }
  redirect(`/admin/audit?id=${id}&done=1`);
}
