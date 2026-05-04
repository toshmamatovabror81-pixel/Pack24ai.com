// ═══════════════════════════════════════════════════════════════════════════════
// Pack24 Telegram Bot — Markazlashtirilgan Keyboard kutubxonasi
// Barcha rol-based tugmalar shu yerda boshqariladi
// ═══════════════════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getText, type Lang } from './i18n';

// ─── Tur ta'riflari — Telegraf bilan mos ─────────────────────────────────────
type ReplyKeyboard = {
    keyboard: any[][];
    resize_keyboard: boolean;
    one_time_keyboard?: boolean;
};

type InlineKeyboard = {
    inline_keyboard: any[][];
};

// ─── Yordamchi funksiyalar ───────────────────────────────────────────────────
export function btn(text: string, data: string) {
    return { text, callback_data: data };
}

export function urlBtn(text: string, url: string) {
    return { text, url };
}

// ══════════════════════════════════════════════════════════════════════════════
// 👤 MIJOZ BOT TUGMALARI (@Pack24AI_bot)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Mijoz bosh menyu klaviaturasi — til bo'yicha
 */
export function customerMainKeyboard(lang: Lang, appUrl?: string): ReplyKeyboard {
    const rows: any[][] = [];

    if (appUrl) {
        rows.push([{
            text: getText('btn_open_app', lang),
            web_app: { url: `${appUrl}/mobile` },
        }]);
    }

    rows.push(
        [{ text: getText('btn_catalog', lang) }, { text: getText('btn_recycle', lang) }],
        [{ text: getText('btn_my_requests', lang) }, { text: getText('btn_ai', lang) }],
        [{ text: getText('btn_contact', lang) }, { text: getText('btn_settings', lang) }],
    );

    return { keyboard: rows, resize_keyboard: true };
}

/**
 * Til tanlash (inline) — /start
 */
export function langSelectKeyboard(): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn('🇺🇿 O\'zbekcha', 'lang_uz')],
            [btn('🇷🇺 Русский', 'lang_ru')],
            [btn('🇬🇧 English', 'lang_en')],
        ],
    };
}

/**
 * Telefon ulashish tugmasi
 */
export function sharePhoneKeyboard(lang: Lang): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: getText('share_contact', lang), request_contact: true }],
            [{ text: getText('cancel', lang) }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

/**
 * Lokatsiya ulashish tugmasi
 */
export function shareLocationKeyboard(lang: Lang): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: getText('location_gps', lang), request_location: true }],
            [{ text: getText('location_text', lang) }],
            [{ text: getText('cancel', lang) }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

/**
 * Makulatura xizmat turi (inline)
 */
export function recycleMethodKeyboard(lang: Lang): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn(getText('btn_self_delivery', lang), 'recycle_self')],
            [btn(getText('btn_call_truck', lang), 'recycle_truck')],
            [btn(getText('cancel', lang), 'recycle_cancel')],
        ],
    };
}

/**
 * Hajm tanlash (inline)
 */
export function volumeKeyboard(lang: Lang): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn(getText('vol_small', lang), 'vol_small')],
            [btn(getText('vol_medium', lang), 'vol_medium')],
            [btn(getText('vol_large', lang), 'vol_large')],
            [btn(getText('cancel', lang), 'recycle_cancel')],
        ],
    };
}

/**
 * Rasm yoki o'tkazib yuborish (inline)
 */
export function photoOrSkipKeyboard(lang: Lang): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn(getText('btn_skip_photo', lang), 'skip_photo')],
            [btn(getText('cancel', lang), 'recycle_cancel')],
        ],
    };
}

/**
 * Mijoz hisob-kitobni tasdiqlash (inline) — Customer Bot ga yuboriladi
 */
export function customerConfirmKeyboard(collectionId: number, lang: Lang): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                btn(lang === 'ru' ? '✅ Подтверждаю' : lang === 'en' ? '✅ Confirm' : '✅ Tasdiqlayman', `cust_confirm_${collectionId}`),
                btn(lang === 'ru' ? '❌ Отклоняю' : lang === 'en' ? '❌ Reject' : '❌ Inkor qilaman', `cust_reject_${collectionId}`),
            ],
        ],
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// 🚚 HAYDOVCHI BOT TUGMALARI (@pack24MX_bot)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Haydovchi bosh menyu klaviaturasi
 */
export function driverMainKeyboard(isOnline: boolean = false, lang: Lang = 'uz'): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: getText('drv_btn_tasks', lang) }],
            [
                { text: isOnline ? getText('drv_btn_offline', lang) : getText('drv_btn_online', lang) },
                { text: getText('drv_btn_profile', lang) },
            ],
            [{ text: getText('drv_btn_report', lang) }],
        ],
        resize_keyboard: true,
    };
}

/**
 * Haydovchi telefon ulashish
 */
export function driverSharePhoneKeyboard(): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: '📱 Telefon raqamimni ulashish', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

/**
 * Topshiriq amallar tugmalari (inline)
 */
export function taskActionKeyboard(requestId: number, status: string): InlineKeyboard {
    const rows: any[][] = [];

    if (status === 'dispatched' || status === 'new') {
        rows.push([
            btn('✅ Qabul qilish', `accept_${requestId}`),
            btn('❌ Rad etish', `reject_${requestId}`),
        ]);
    }
    if (status === 'assigned') {
        rows.push([btn('🚚 Yo\'lga chiqdim', `enroute_${requestId}`)]);
    }
    if (status === 'en_route') {
        rows.push([btn('📍 Yetib keldim', `arrived_${requestId}`)]);
    }
    if (status === 'arrived') {
        rows.push([btn('⚖️ Kalkulyatorni boshlash', `calc_${requestId}`)]);
    }

    return { inline_keyboard: rows };
}

/**
 * Kalkulyator tasdiqlash (inline)
 */
export function calcConfirmKeyboard(requestId: number): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                btn('✅ Tasdiqlash', `confirm_calc_${requestId}`),
                btn('❌ Bekor qilish', 'calc_cancel'),
            ],
        ],
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// 👷 MASUL BOT TUGMALARI (@pack24AUP_bot)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Masul bosh menyu klaviaturasi
 */
export function supervisorMainKeyboard(): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: '📋 Arizalar' }, { text: '👥 Haydovchilar' }],
            [{ text: '📝 Driver arizalari' }],
            [{ text: '✏️ Jurnal tahriri (HQ)' }],
            [{ text: '💰 To\'lovlar' }, { text: '🏭 Punkt holati' }],
            [{ text: '📥 Qabul' }, { text: '🏭 Press' }],
            [{ text: '💸 Xarajat' }, { text: '💼 Kassa' }],
            [{ text: '🚛 Sotuv' }, { text: '📊 Hisobotlar' }],
            [{ text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
    };
}

/**
 * Masul telefon ulashish
 */
export function supervisorSharePhoneKeyboard(): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: '📱 Telefon raqamimni ulashish', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

/**
 * HQ admin bosh menyu klaviaturasi
 */
export function pack24AdminMainKeyboard(): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: '👷 Masullar' }, { text: '🚚 Haydovchilar' }],
            [{ text: '📝 Admin arizalari' }],
            [{ text: '📋 Jurnal tahrirlari' }],
            [{ text: '📡 Hodisalar' }, { text: '🚨 Ogohlantirishlar' }],
            [{ text: '📊 Statistika' }, { text: '✅ Barchasini o\'qildi' }],
            [{ text: '👤 Profil' }, { text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
    };
}

/**
 * HQ admin telefon ulashish
 */
export function pack24AdminSharePhoneKeyboard(): ReplyKeyboard {
    return {
        keyboard: [
            [{ text: '📱 Telefon raqamimni ulashish', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

/**
 * Haydovchi tanlash (ariza uchun) — inline
 */
export function assignDriverKeyboard(
    drivers: { id: number; name: string; vehicleInfo?: string | null; isOnline: boolean }[],
    requestId: number
): InlineKeyboard {
    const rows: any[][] = drivers.map(d => [
        btn(
            `${d.isOnline ? '🟢' : '🔴'} ${d.name}${d.vehicleInfo ? ` (${d.vehicleInfo})` : ''}`,
            `select_drv_${d.id}_${requestId}`
        ),
    ]);
    rows.push([btn('❌ Bekor', 'adm_cancel')]);
    return { inline_keyboard: rows };
}

/**
 * Ariza amallar tugmalari — masul uchun (inline)
 */
export function requestActionKeyboard(requestId: number, hasDriver: boolean, driverName?: string, hasLocation?: boolean, lat?: number, lng?: number): InlineKeyboard {
    const rows: any[][] = [];

    if (!hasDriver) {
        rows.push([btn('🚚 Haydovchi tayinlash', `assign_driver_${requestId}`)]);
    } else if (driverName) {
        rows.push([btn(`👤 ${driverName}`, `driver_info_${requestId}`)]);
    }

    if (hasLocation && lat && lng) {
        rows.push([urlBtn('📍 Lokatsiyani ko\'rish', `https://maps.google.com/maps?q=${lat},${lng}`)]);
    }

    return { inline_keyboard: rows };
}

/**
 * To'lov tasdiqlash — masul uchun (inline)
 */
export function paymentApproveKeyboard(collectionId: number): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn('✅ To\'lovni tasdiqlash', `approve_payment_${collectionId}`)],
        ],
    };
}

/**
 * Punkt holati o'zgartirish (inline)
 */
export function pointToggleKeyboard(pointId: number, isAccepting: boolean): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn(isAccepting ? '🔴 Yopish' : '🟢 Ochish', `toggle_point_${pointId}`)],
        ],
    };
}

/**
 * Hisobot davr tanlash (inline)
 */
export function reportPeriodKeyboard(): InlineKeyboard {
    return {
        inline_keyboard: [
            [
                btn('📅 Bugun', 'report_today'),
                btn('📆 Hafta', 'report_week'),
                btn('🗓 Oy', 'report_month'),
            ],
        ],
    };
}

/**
 * Ortga tugmasi
 */
export function backKeyboard(): InlineKeyboard {
    return { inline_keyboard: [[btn('◀️ Ortga', 'adm_cancel')]] };
}

/**
 * Shaxsiy kabinet inline tugmalari
 */
export function cabinetMenuKeyboard(lang: Lang): InlineKeyboard {
    return {
        inline_keyboard: [
            [btn(getText('cabinet_btn_recycling', lang), 'cab_recycling')],
            [btn(getText('cabinet_btn_orders', lang), 'cab_orders')],
            [btn(getText('cabinet_btn_referral', lang), 'cab_referral')],
            [
                btn(getText('cabinet_btn_code', lang), 'cab_show_code'),
                btn(getText('cabinet_btn_settings', lang), 'cab_settings'),
            ],
        ],
    };
}

// ─── Eski nomlar bilan moslik (handlers/ papkasi uchun) ───────────────────────
export const customerKeyboard = customerMainKeyboard;
export const supervisorKeyboard = supervisorMainKeyboard;
export const driverKeyboard = driverMainKeyboard;
