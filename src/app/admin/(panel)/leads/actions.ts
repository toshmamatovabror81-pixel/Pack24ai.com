'use server';

import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { optText } from '@/lib/formData';

export async function updateLead(fd: FormData) {
  await requireStaff('leads');
  const id = Number(fd.get('id'));
  const status = (['new_', 'in_progress', 'done', 'rejected'] as LeadStatus[]).find((s) => s === fd.get('status'));
  await prisma.lead.update({ where: { id }, data: { ...(status ? { status } : {}), managerNote: optText(fd, 'managerNote', 2000) } });
  revalidatePath('/admin/leads');
}
