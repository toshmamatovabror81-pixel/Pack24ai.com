'use server';

import { z } from 'zod';
import { prisma } from './db';
import { rateLimit } from './rateLimit';
import { notifyAdmins } from './telegram';

export type ReviewState = { ok?: boolean; error?: boolean } | null;

const schema = z.object({
  authorName: z.string().trim().min(2).max(80),
  company: z.string().trim().max(120).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(2000),
});

export async function submitReview(_: ReviewState, fd: FormData): Promise<ReviewState> {
  if (String(fd.get('website') ?? '')) return { ok: true };
  if (!(await rateLimit('review', 3, 60 * 60_000))) return { error: true };
  const parsed = schema.safeParse({ authorName: fd.get('name'), company: fd.get('company') || undefined, rating: fd.get('rating'), text: fd.get('text') });
  if (!parsed.success) return { error: true };
  const r = await prisma.review.create({ data: { ...parsed.data, status: 'pending' } });
  await notifyAdmins([`⭐ Yangi sharh #${r.id} (${r.rating}/5) tasdiqlashni kutmoqda`, r.authorName, r.text.slice(0, 300)]);
  return { ok: true };
}
