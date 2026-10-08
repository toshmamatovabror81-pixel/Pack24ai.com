'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { bool, date, i18nFrom, num, optText, text } from '@/lib/formData';
import { slugify } from '@/lib/slug';

const site = () => revalidatePath('/[lang]', 'layout');

// ─── Promokodlar ──────────────────────────────────────────────
export async function savePromo(fd: FormData) {
  await requireStaff('marketing');
  const id = Number(fd.get('id')) || null;
  const code = text(fd, 'code', 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const value = num(fd, 'value');
  const type = fd.get('type') === 'fixed' ? 'fixed' : 'percent';
  const back = id ? `/admin/promo/${id}` : '/admin/promo/new';
  if (!code || value == null || value <= 0 || (type === 'percent' && value > 100)) redirect(`${back}?error=1`);
  const clash = await prisma.promoCode.findFirst({ where: { code, ...(id ? { id: { not: id } } : {}) } });
  if (clash) redirect(`${back}?error=exists`);
  const maxUses = num(fd, 'maxUses');
  const data = {
    code,
    type: type as 'fixed' | 'percent',
    value,
    minSubtotal: num(fd, 'minSubtotal') ?? 0,
    maxUses: maxUses && maxUses > 0 ? Math.floor(maxUses) : null,
    startsAt: date(fd, 'startsAt'),
    endsAt: date(fd, 'endsAt'),
    isActive: bool(fd, 'isActive'),
    note: optText(fd, 'note', 300),
  };
  const saved = id ? await prisma.promoCode.update({ where: { id }, data }) : await prisma.promoCode.create({ data });
  redirect(`/admin/promo/${saved.id}?saved=1`);
}

// ─── Bannerlar ────────────────────────────────────────────────
export async function saveBanner(fd: FormData) {
  await requireStaff('marketing');
  const id = Number(fd.get('id')) || null;
  const data = {
    titleI18n: i18nFrom(fd, 'title'),
    textI18n: i18nFrom(fd, 'text'),
    image: optText(fd, 'image', 1000),
    href: optText(fd, 'href', 500),
    sortOrder: Math.floor(num(fd, 'sortOrder') ?? 0),
    isActive: bool(fd, 'isActive'),
  };
  const saved = id ? await prisma.banner.update({ where: { id }, data }) : await prisma.banner.create({ data });
  site();
  redirect(`/admin/banners/${saved.id}?saved=1`);
}

export async function deleteBanner(fd: FormData) {
  await requireStaff('marketing');
  await prisma.banner.delete({ where: { id: Number(fd.get('id')) } });
  site();
  redirect('/admin/banners');
}

// ─── Sharhlar ─────────────────────────────────────────────────
export async function moderateReview(fd: FormData) {
  await requireStaff('marketing');
  const id = Number(fd.get('id'));
  const action = String(fd.get('action'));
  if (action === 'delete') await prisma.review.delete({ where: { id } });
  else {
    const status = (['approved', 'rejected', 'pending'] as ReviewStatus[]).find((s) => s === action);
    if (status) await prisma.review.update({ where: { id }, data: { status } });
  }
  site();
  revalidatePath('/admin/reviews');
}

// ─── Blog ─────────────────────────────────────────────────────
export async function savePost(fd: FormData) {
  await requireStaff('content');
  const id = Number(fd.get('id')) || null;
  const titleI18n = i18nFrom(fd, 'title');
  const back = id ? `/admin/posts/${id}` : '/admin/posts/new';
  if (!titleI18n.uz) redirect(`${back}?error=title`);
  const slug = slugify(text(fd, 'slug', 100) || titleI18n.uz);
  const clash = await prisma.post.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash || !slug) redirect(`${back}?error=slug`);
  const isPublished = bool(fd, 'isPublished');
  const old = id ? await prisma.post.findUnique({ where: { id } }) : null;
  const data = {
    slug,
    titleI18n,
    excerptI18n: i18nFrom(fd, 'excerpt'),
    bodyI18n: i18nFrom(fd, 'body'),
    cover: optText(fd, 'cover', 1000),
    isPublished,
    publishedAt: isPublished ? (old?.publishedAt ?? new Date()) : old?.publishedAt ?? null,
  };
  const saved = id ? await prisma.post.update({ where: { id }, data }) : await prisma.post.create({ data });
  site();
  redirect(`/admin/posts/${saved.id}?saved=1`);
}

export async function deletePost(fd: FormData) {
  await requireStaff('content');
  await prisma.post.delete({ where: { id: Number(fd.get('id')) } });
  site();
  redirect('/admin/posts');
}

// ─── FAQ ──────────────────────────────────────────────────────
export async function saveFaq(fd: FormData) {
  await requireStaff('content');
  const id = Number(fd.get('id')) || null;
  const questionI18n = i18nFrom(fd, 'question');
  if (!questionI18n.uz) redirect(id ? `/admin/faq/${id}?error=1` : '/admin/faq/new?error=1');
  const data = { questionI18n, answerI18n: i18nFrom(fd, 'answer'), sortOrder: Math.floor(num(fd, 'sortOrder') ?? 0), isActive: bool(fd, 'isActive') };
  const saved = id ? await prisma.faqItem.update({ where: { id }, data }) : await prisma.faqItem.create({ data });
  site();
  redirect(`/admin/faq/${saved.id}?saved=1`);
}

export async function deleteFaq(fd: FormData) {
  await requireStaff('content');
  await prisma.faqItem.delete({ where: { id: Number(fd.get('id')) } });
  site();
  redirect('/admin/faq');
}
