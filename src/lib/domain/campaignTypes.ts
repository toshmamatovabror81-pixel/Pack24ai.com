/**
 * Campaign type — typed source-of-truth
 *
 * Prisma schema'da `Campaign.type` hali `String`.
 * Bu fayl yagona manba.
 */

export const CAMPAIGN_TYPES = ['telegram', 'sms', 'email'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
    telegram: '📱 Telegram',
    sms: '💬 SMS',
    email: '📧 Email',
};

export function isValidCampaignType(value: unknown): value is CampaignType {
    return typeof value === 'string' && (CAMPAIGN_TYPES as readonly string[]).includes(value);
}
