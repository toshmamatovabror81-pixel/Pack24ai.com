import { getText } from './i18n';
import type { Lang } from './i18n';
import { JOURNAL_CORRECTION_REPLY_BUTTON } from './adminBot.journalCorrection';

const BTN_LANGS: Lang[] = ['uz', 'ru', 'en'];

/**
 * Reply-klaviaturadagi boshqa bo'limga o'tish: jurnal sahifasi ochiq bo'lsa
 * ham matn sana parseriga tushmasin.
 */
export function isSupervisorReplyMenuText(text: string): boolean {
    const i18nKeys = [
        'adm_btn_requests',
        'adm_btn_drivers',
        'adm_btn_payments',
        'adm_btn_point',
        'adm_btn_report',
    ] as const;

    for (const key of i18nKeys) {
        for (const l of BTN_LANGS) {
            if (text === getText(key, l)) return true;
        }
    }

    const fixed = [
        '📝 Driver arizalari',
        '📥 Qabul',
        '🏭 Press',
        '💸 Xarajat',
        '💼 Kassa',
        '🚛 Sotuv',
        '❓ Yordam',
        JOURNAL_CORRECTION_REPLY_BUTTON,
    ];

    return fixed.includes(text);
}
