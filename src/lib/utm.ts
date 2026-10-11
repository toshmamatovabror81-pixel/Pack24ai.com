export const UTM_COOKIE = 'p24_utm';
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
};

const clip = (v: unknown, n = 200) => (typeof v === 'string' && v ? v.slice(0, n) : undefined);

export function parseAttribution(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      utmSource: clip(o.utm_source),
      utmMedium: clip(o.utm_medium),
      utmCampaign: clip(o.utm_campaign),
      utmContent: clip(o.utm_content),
      utmTerm: clip(o.utm_term),
      referrer: clip(o.referrer, 500),
      landingPage: clip(o.landing, 500),
    };
  } catch {
    return {};
  }
}
