'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from './db';
import { normalizePhone, displayPhone } from './format';
import { notifyAdmins } from './telegram';
import { notifyStaffLead } from './orderNotify';
import { settleWithin } from './background';
import { parseAttribution, UTM_COOKIE } from './utm';
import { rateLimit } from './rateLimit';
import { siteUrl } from './site';

export type LeadState = { ok?: boolean; error?: 'phone' | 'name' | 'rate' | 'server' } | null;

/** Ariza saqlangach mijoz Telegram xabarnomalarini ko'pi bilan shuncha kutadi (checkout bilan bir xil — orders.ts) */
const NOTIFY_WAIT_MS = 3_000;

const TYPES = ['wholesale', 'custom_box', 'callback', 'contact'] as const;
const TYPE_NAMES: Record<(typeof TYPES)[number], string> = {
  wholesale: "Ulgurji narx so'rovi",
  custom_box: 'Individual quti / logotip',
  callback: "Qayta qo'ng'iroq",
  contact: 'Aloqa formasi',
};
const DETAIL_KEYS = ['product', 'size', 'quantity', 'logo'] as const;

const schema = z.object({
  type: z.enum(TYPES),
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(150).optional(),
  message: z.string().trim().max(3000).optional(),
});

export async function submitLead(_: LeadState, fd: FormData): Promise<LeadState> {
  // Botlar uchun yashirin maydon: to'ldirilgan bo'lsa jim qabul qilgandek qaytamiz
  if (String(fd.get('website') ?? '')) return { ok: true };
  if (!(await rateLimit('lead', 8, 60 * 60_000))) return { error: 'rate' };
  const phone = normalizePhone(String(fd.get('phone') ?? ''));
  if (!phone) return { error: 'phone' };
  const parsed = schema.safeParse({
    type: fd.get('type'),
    name: fd.get('name'),
    company: fd.get('company') || undefined,
    message: fd.get('message') || undefined,
  });
  if (!parsed.success) return { error: 'name' };
  const details: Record<string, string> = {};
  for (const k of DETAIL_KEYS) {
    const v = String(fd.get(k) ?? '').trim();
    if (v) details[k] = v.slice(0, 300);
  }
  const productId = Number(fd.get('productId')) || null;
  const a = parseAttribution((await cookies()).get(UTM_COOKIE)?.value);
  let leadId: number;
  try {
    const lead = await prisma.lead.create({
      data: {
        type: parsed.data.type,
        name: parsed.data.name,
        phone,
        company: parsed.data.company,
        message: parsed.data.message,
        details,
        productId,
        utmSource: a.utmSource,
        utmMedium: a.utmMedium,
        utmCampaign: a.utmCampaign,
        landingPage: a.landingPage,
      },
    });
    leadId = lead.id;
  } catch (e) {
    console.error('submitLead', e);
    return { error: 'server' };
  }
  // Ariza saqlanib bo'ldi: xabarnomadagi xato endi mijozga "xato" bo'lib qaytmaydi (aks holda u arizani qayta yuboradi).
  // Eski admin guruhga va boshqaruv botiga ulangan, "arizalar" ruxsati bor xodimlarga bir xil matn birga ketadi; mijoz ko'pi
  // bilan 3 s kutadi — Telegram sekin yoki javob bermayotgan bo'lsa qolgani fonda tugaydi (background.ts).
  await settleWithin(
    (async () => {
      const lines = [
        `📩 ${TYPE_NAMES[parsed.data.type]} #${leadId}`,
        `${parsed.data.name}${parsed.data.company ? `, ${parsed.data.company}` : ''}`,
        displayPhone(phone),
        ...Object.entries(details).map(([k, v]) => `${k}: ${v}`),
        parsed.data.message,
        a.utmSource ? `Manba: ${a.utmSource}` : null,
        `${siteUrl()}/admin/leads`,
      ];
      await Promise.all([notifyAdmins(lines), notifyStaffLead(lines)]);
    })().catch((e) => console.error('submitLead: xabarnoma', leadId, e)),
    NOTIFY_WAIT_MS,
  );
  return { ok: true };
}
