import { initCustomerBot } from './customerBot';
import { initDriverBot } from './driverBot';
import { initAdminBot } from './adminBot';
import { initPack24AdminBot } from './pack24AdminBot';
import type { TelegramRuntimeBot } from './runtime';

/** `/api/telegram/start-polling` va ixtiyoriy dev-auto-polling uchun bir xil ro‘yxat */
export const TELEGRAM_POLLING_BOT_ENTRIES: TelegramRuntimeBot[] = [
    {
        name: '@Pack24AI_bot (Customer)',
        webhookPath: '/api/telegram/webhook',
        init: initCustomerBot,
    },
    {
        name: '@pack24MX_bot (Driver)',
        webhookPath: '/api/telegram/webhook/driver',
        init: initDriverBot,
    },
    {
        name: '@pack24AUP_bot (Admin)',
        webhookPath: '/api/telegram/webhook/admin',
        init: initAdminBot,
    },
    {
        name: '@pack24admin_bot (HQ Admin)',
        webhookPath: '/api/telegram/webhook/pack24admin',
        init: initPack24AdminBot,
    },
];
