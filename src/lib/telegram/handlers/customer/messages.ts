import { Telegraf } from 'telegraf';
import {
    registerRegistrationHandlers,
    handleOtpVerification,
    handleNameRegistration,
    handleMenuButtons,
    handleAiChat,
    registerRecycleFlowHandlers,
    handleLocationTextFallback,
} from './messages/index';

export function registerMessageHandlers(bot: Telegraf) {
    // Contact handler (registration flow)
    registerRegistrationHandlers(bot);

    // Location & Photo handlers (recycle flow)
    registerRecycleFlowHandlers(bot);

    // TEXT HANDLER
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        // OTP verification
        if (await handleOtpVerification(ctx, tgId, text)) return;

        // F.I.Sh. kiritish
        if (await handleNameRegistration(ctx, tgId, text)) return;

        // Menyu tugmalari
        if (await handleMenuButtons(ctx, tgId, text)) return;

        // ─── AI Chat mode ─────────────────────────────────────────────────
        if (await handleAiChat(ctx, tgId, text)) return;

        // Text fallback for location step
        if (await handleLocationTextFallback(ctx, tgId, text)) return;
    });
}
