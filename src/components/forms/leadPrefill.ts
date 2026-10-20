'use client';

/** Boshqa komponent (masalan, quti kalkulyatori) LeadForm maydonlarini to'ldirishi uchun hodisa */
export const LEAD_PREFILL_EVENT = 'pack24:lead-prefill';

export type LeadPrefill = {
  /** Ariza turi (types ro'yxatida bo'lsa tanlanadi) */
  type?: string;
  /** Maydon nomi → qiymat */
  fields: Record<string, string>;
};

/** Formani to'ldiradi va unga aylantiradi; anchorId — forma o'ralgan element id si */
export function prefillLeadForm(detail: LeadPrefill, anchorId = 'lead-form') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LeadPrefill>(LEAD_PREFILL_EVENT, { detail }));
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
