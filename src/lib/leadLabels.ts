import type { Dict } from './i18n';

export const leadLabels = (t: Dict) => ({
  send: t.common.send,
  sending: t.common.sending,
  thanks: t.common.thanks,
  error: t.common.error,
  phoneError: `${t.common.phone}: ${t.common.required}`,
  typeLabel: t.forms.type,
});

export const contactFields = (t: Dict) => [
  { name: 'name', label: t.common.name, required: true },
  { name: 'phone', label: t.common.phone, type: 'tel' as const, required: true },
];
