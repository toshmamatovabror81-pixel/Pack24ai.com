import { prisma } from '@/lib/prisma';
import { sessions, getUserByTgId, getUserLang } from '../helpers';
import { getText, formatText } from '../../../i18n';
import { btn, shareLocationKeyboard } from '../../../keyboards';

/**
 * Handle menu button presses in text handler.
 * Returns true if this handler consumed the message.
 */
export async function handleMenuButtons(ctx: any, tgId: string, text: string): Promise<boolean> {
    const lang = await getUserLang(tgId);

    if (text === getText('btn_recycle', lang) || text === getText('btn_recycle', 'uz') || text === getText('btn_recycle', 'ru') || text === getText('btn_recycle', 'en')) {
        sessions.set(tgId, { step: 'location', lang });
        await ctx.reply(getText('recycle_start', lang), { parse_mode: 'HTML', reply_markup: shareLocationKeyboard(lang) });
        return true;
    }

    if (text === getText('btn_catalog', lang) || text === getText('btn_catalog', 'uz') || text === getText('btn_catalog', 'ru') || text === getText('btn_catalog', 'en')) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.uz';
        await ctx.reply(
            lang === 'uz' ? '📦 Mahsulotlar katalogi:' : lang === 'ru' ? '📦 Каталог продукции:' : '📦 Product catalog:',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: lang === 'uz' ? '🛒 Katalogni ochish' : lang === 'ru' ? '🛒 Открыть каталог' : '🛒 Open catalog', url: appUrl }],
                        [{ text: lang === 'uz' ? '🤖 @Pack24uzbot' : '🤖 @Pack24uzbot', url: 'https://t.me/Pack24uzbot' }],
                    ],
                },
            }
        );
        return true;
    }

    if (text === getText('btn_contact', lang) || text === getText('btn_contact', 'uz') || text === getText('btn_contact', 'ru') || text === getText('btn_contact', 'en')) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.ai';
        const domain = appUrl.replace('https://', '').replace('http://', '');
        await ctx.reply(
            lang === 'uz'
                ? `📞 <b>Bog'lanish</b>\n\n☎️ Telefon: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Telefon: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Sayt: ${domain}`
                : lang === 'ru'
                ? `📞 <b>Контакты</b>\n\n☎️ Телефон: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Телефон: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Сайт: ${domain}`
                : `📞 <b>Contact Us</b>\n\n☎️ Phone: <a href="tel:+998880557888">+998 88 055-78-88</a>\n☎️ Phone: <a href="tel:+998951050052">+998 95 105-00-52</a>\n✉️ Email: sales@pack24.uz\n💬 Telegram: @pack24uz\n🌐 Website: ${domain}`,
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
        );
        return true;
    }

    if (text === getText('btn_my_requests', lang) || text === getText('btn_my_requests', 'uz') || text === getText('btn_my_requests', 'ru') || text === getText('btn_my_requests', 'en')) {
        const myReqs = await prisma.recycleRequest.findMany({
            where: { customerTgId: tgId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { point: true },
        });
        if (myReqs.length === 0) {
            await ctx.reply(lang === 'uz' ? '📋 Sizda hali ariza yo\'q.' : lang === 'ru' ? '📋 У вас пока нет заявок.' : '📋 You have no requests yet.');
            return true;
        }
        const statusMap: Record<string, string> = {
            new: '🔵', dispatched: '📋', assigned: '🚚', en_route: '🚚', arrived: '📍',
            collecting: '⚖️', completed: '✅', cancelled: '❌',
        };
        const list = myReqs.map(r =>
            `${statusMap[r.status] || '⚪'} <b>#${r.id}</b> — ${r.point?.regionUz || '—'} — ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`
        ).join('\n');
        await ctx.reply(`📋 <b>${lang === 'uz' ? 'Arizalaringiz' : lang === 'ru' ? 'Ваши заявки' : 'Your requests'}:</b>\n\n${list}`, { parse_mode: 'HTML' });
        return true;
    }

    // ─── 🌿 PRTS Ballarim tugmasi ─────────────────────────────────────
    if (text === getText('btn_prts', lang) || text === getText('btn_prts', 'uz') || text === getText('btn_prts', 'ru') || text === getText('btn_prts', 'en')) {
        const user = await getUserByTgId(tgId);
        if (!user) {
            await ctx.reply(lang === 'uz' ? '❌ Avval ro\'yxatdan o\'ting. /start bosing.' : '❌ Сначала зарегистрируйтесь. Нажмите /start.');
            return true;
        }
        // 1) PRTS haqida ma'lumot
        await ctx.reply(getText('prts_info', lang), { parse_mode: 'HTML' });

        // 2) Shaxsiy dashboard
        const totalWeight = user.totalRecycledWeight || 0;
        await ctx.reply(
            formatText('prts_dashboard', lang, {
                name: user.name,
                weight: String(totalWeight),
                co2: (totalWeight * 2.5).toFixed(1),
                trees: (totalWeight * 0.017).toFixed(1),
                water: (totalWeight * 26).toFixed(0),
                points: String(user.ecoPoints || 0),
            }),
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🎁 Mukofotlar', callback_data: 'prts_rewards' },
                            { text: '♻️ Topshirish', callback_data: 'cab_recycling' },
                        ],
                        [
                            { text: 'ℹ️ PRTS nima?', callback_data: 'prts_info' },
                        ],
                    ],
                },
            }
        );
        return true;
    }

    if (text === getText('btn_ai', lang) || text === getText('btn_ai', 'uz') || text === getText('btn_ai', 'ru') || text === getText('btn_ai', 'en')) {
        sessions.set(tgId, { step: 'ai_chat', lang, aiHistory: [] });
        await ctx.reply(
            lang === 'uz' ? '🤖 <b>Pack24 AI Assistent</b>\n\nSavolingizni yozing — qadoqlash, narxlar, buyurtma berish bo\'yicha yordam beraman!\n\n💡 Chiqish uchun «◀️ Menyu» tugmasini bosing.'
            : lang === 'ru' ? '🤖 <b>Pack24 AI Ассистент</b>\n\nЗадайте вопрос — помогу с упаковкой, ценами, заказами!\n\n💡 Нажмите «◀️ Меню» чтобы выйти.'
            : '🤖 <b>Pack24 AI Assistant</b>\n\nAsk me about packaging, pricing, orders!\n\n💡 Press «◀️ Menu» to exit.',
            {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [{ text: lang === 'uz' ? '◀️ Menyu' : lang === 'ru' ? '◀️ Меню' : '◀️ Menu' }],
                    ],
                    resize_keyboard: true,
                },
            }
        );
        return true;
    }

    if (text === getText('btn_settings', lang) || text === getText('btn_settings', 'uz') || text === getText('btn_settings', 'ru') || text === getText('btn_settings', 'en')) {
        const user = await getUserByTgId(tgId);
        const code = user?.telegramCode || '—';
        const name = user?.name || '—';
        const phone = user?.phone || '—';

        await ctx.reply(
            lang === 'uz'
                ? `⚙️ <b>Sozlamalar</b>\n\n👤 Ism: <b>${name}</b>\n📱 Telefon: <b>${phone}</b>\n\n🔑 <b>Kirish kodi:</b> <code>${code}</code>\n🌐 <b>pack24.ai</b> saytida shu kod va telefon bilan kiring.\n\n🌐 Tilni o'zgartiring:`
                : lang === 'ru'
                ? `⚙️ <b>Настройки</b>\n\n👤 Имя: <b>${name}</b>\n📱 Телефон: <b>${phone}</b>\n\n🔑 <b>Код входа:</b> <code>${code}</code>\n🌐 Войдите на <b>pack24.ai</b> с этим кодом.\n\n🌐 Изменить язык:`
                : `⚙️ <b>Settings</b>\n\n👤 Name: <b>${name}</b>\n📱 Phone: <b>${phone}</b>\n\n🔑 <b>Login code:</b> <code>${code}</code>\n🌐 Use this at <b>pack24.ai</b> to login.\n\n🌐 Change language:`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [btn('🇺🇿 O\'zbekcha', 'lang_uz'), btn('🇷🇺 Русский', 'lang_ru'), btn('🇬🇧 English', 'lang_en')],
                        [{ text: '◀️ Asosiy menyu', callback_data: 'back_main' }],
                    ],
                },
            }
        );
        return true;
    }

    return false;
}
