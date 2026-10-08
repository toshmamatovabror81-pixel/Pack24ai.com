'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { saveSettings, type SiteSettings } from '@/lib/settings';
import { i18nFrom, num, text } from '@/lib/formData';
import { normalizePhone } from '@/lib/format';

export async function updateSettings(fd: FormData) {
  await requireStaff('settings');
  const phone = normalizePhone(text(fd, 'phone', 30));
  const phone2 = normalizePhone(text(fd, 'phone2', 30));
  const patch: Partial<SiteSettings> = {
    companyName: text(fd, 'companyName', 100) || 'Pack24',
    legalName: text(fd, 'legalName', 200),
    inn: text(fd, 'inn', 20).replace(/\D/g, ''),
    bankDetails: text(fd, 'bankDetails', 1000),
    ...(phone ? { phone } : {}),
    phone2: phone2 ?? '',
    email: text(fd, 'email', 120),
    address: i18nFrom(fd, 'address'),
    workHours: i18nFrom(fd, 'workHours'),
    mapEmbedUrl: text(fd, 'mapEmbedUrl', 1000),
    telegramBot: text(fd, 'telegramBot', 64).replace(/^@|^https:\/\/t\.me\//, ''),
    telegramChannel: text(fd, 'telegramChannel', 64).replace(/^@|^https:\/\/t\.me\//, ''),
    instagram: text(fd, 'instagram', 64).replace(/^@|^https:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''),
    deliveryFee: Math.max(0, num(fd, 'deliveryFee') ?? 0),
    freeDeliveryFrom: Math.max(0, num(fd, 'freeDeliveryFrom') ?? 0),
    yandexMetrikaId: text(fd, 'yandexMetrikaId', 20).replace(/\D/g, ''),
    ga4Id: text(fd, 'ga4Id', 20).toUpperCase(),
    deliveryText: i18nFrom(fd, 'deliveryText'),
    paymentText: i18nFrom(fd, 'paymentText'),
    privacyText: i18nFrom(fd, 'privacyText'),
    offerText: i18nFrom(fd, 'offerText'),
    vacanciesText: i18nFrom(fd, 'vacanciesText'),
  };
  await saveSettings(patch);
  revalidateTag('settings');
  revalidatePath('/[lang]', 'layout');
  redirect('/admin/settings?saved=1');
}
