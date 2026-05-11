import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sessions, getUserByTgId, generateUniqueUserCode, normalizePhone, getUserLang } from './helpers';
import { Lang, getText, formatText } from '../../i18n';
import { btn, customerMainKeyboard, sharePhoneKeyboard, shareLocationKeyboard, recycleMethodKeyboard } from '../../keyboards';
import { submitTruckRequest } from './truckRequest';
import type { CustomerSession } from './types';

export function registerMessageHandlers(bot: Telegraf) {
    // CONTACT HANDLER
    bot.on('contact', async (ctx) => {
        const tgId = ctx.from.id.toString();
        let ses = sessions.get(tgId);

        if (!ses || !['reg_phone', 'menu'].includes(ses.step)) {
            const existingUser = await getUserByTgId(tgId);
            if (existingUser) {
                const lang: Lang = 'uz';
                sessions.set(tgId, { step: 'menu', lang });
                await ctx.reply(
                    '🏠 Asosiy menyu',
                    { reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }
            const lang: Lang = 'uz';
            ses = { step: 'reg_phone', lang };
            sessions.set(tgId, ses);
        }

        if (ses?.step === 'reg_phone') {
            const phone = normalizePhone(ctx.message.contact.phone_number);
            const lang = ses.lang;

            if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
                await ctx.reply(
                    lang === 'ru' ? '❌ Пожалуйста, отправьте только свой номер телефона.' : '❌ Iltimos, faqat o\'z raqamingizni yuboring.',
                    { reply_markup: sharePhoneKeyboard(lang) }
                );
                return;
            }

            const existing = await prisma.user.findFirst({ where: { phone } });
            if (existing) {
                // Telegram ID ni yangilash (yangi qurilma yoki akkaunt)
                if (existing.telegramId !== tgId) {
                    await prisma.user.update({
                        where: { id: existing.id },
                        data: { telegramId: tgId, telegramVerifiedAt: new Date() },
                    });
                }
                ses.step = 'menu';
                sessions.set(tgId, { ...ses, phone });
                await ctx.reply(
                    formatText('reg_already_exists', lang, {
                        name: existing.name,
                        phone,
                        code: existing.telegramCode || '—',
                    }),
                    { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }

            // Real otp in production is skipped for speed in current simplified mode
            // Actually, wait, the old code generated OTP and sent it. Let's just create the user directly for simplicity, or we can restore the OTP.
            // Oh, I need to copy the OTP logic precisely to avoid regressions.
            // Let's implement what was there.
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // generateOtp
            const expiry = Date.now() + 5 * 60 * 1000; 

            ses.phone = phone;
            ses.step = 'reg_otp';
            ses.otpCode = otp;
            ses.otpExpiry = expiry;
            ses.otpAttempts = 0;
            sessions.set(tgId, ses);

            await ctx.reply(
                lang === 'ru' ? '⏳ Отправляю код подтверждения...' : '⏳ Tasdiqlash kodi yuborilmoqda...',
                { reply_markup: { remove_keyboard: true } }
            );

            await ctx.reply(
                `🔐 <b>${lang === 'ru' ? 'Код подтверждения' : lang === 'en' ? 'Verification Code' : 'Tasdiqlash kodi'}</b>\n\n` +
                `${lang === 'ru' ? 'Ваш код:' : lang === 'en' ? 'Your code:' : 'Sizning kodingiz:'}\n\n` +
                `<code>${otp}</code>\n\n` +
                `${lang === 'ru' ? '⏱ Действует 5 минут' : lang === 'en' ? '⏱ Valid for 5 minutes' : '⏱ 5 daqiqa amal qiladi'}\n\n` +
                `${lang === 'ru' ? '✏️ Введите этот код:' : lang === 'en' ? '✏️ Enter this code:' : '✏️ Ushbu kodni kiriting:'}`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: lang === 'ru' ? '❌ Отмена' : '❌ Bekor qilish', callback_data: 'reg_cancel' },
                        ]],
                    },
                }
            );
        }
    });

    // LOCATION HANDLER
    bot.on('location', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const ses = sessions.get(tgId);
        if (!ses || ses.step !== 'location') return;

        ses.lat = ctx.message.location.latitude;
        ses.lng = ctx.message.location.longitude;
        ses.step = 'choose_method';
        const lang = ses.lang;

        await ctx.reply(
            getText('recycle_choose', lang),
            { parse_mode: 'HTML', reply_markup: recycleMethodKeyboard(lang) }
        );
    });

    // PHOTO HANDLER
    bot.on('photo', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const ses = sessions.get(tgId);
        if (!ses || ses.step !== 'photo') return;

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await bot.telegram.getFileLink(photo.file_id);

        await submitTruckRequest(ctx, bot, ses, tgId, fileLink.href);
    });

    // TEXT HANDLER
    bot.on('text', async (ctx) => {
        const tgId = ctx.from.id.toString();
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const ses = sessions.get(tgId);

        // OTP verification
        if (ses?.step === 'reg_otp') {
            const lang = ses.lang;
            const input = text.trim();

            if (!/^\d{6}$/.test(input)) {
                await ctx.reply(
                    lang === 'ru' ? '❌ Код должен состоять из 6 цифр. Попробуйте ещё раз:' : '❌ Kod 6 raqamdan iborat bo\'lishi kerak. Qayta kiriting:'
                );
                return;
            }

            if (!ses.otpCode || !ses.otpExpiry || Date.now() > ses.otpExpiry) {
                sessions.delete(tgId);
                await ctx.reply(
                    lang === 'ru'
                        ? '❌ Код истёк. Нажмите /start и попробуйте снова.'
                        : '❌ Kod muddati tugadi. /start ni bosib qayta urinib ko\'ring.',
                    { reply_markup: { remove_keyboard: true } }
                );
                return;
            }

            const attempts = (ses.otpAttempts || 0) + 1;
            if (input !== ses.otpCode) {
                if (attempts >= 5) {
                    sessions.delete(tgId);
                    await ctx.reply(
                        lang === 'ru'
                            ? '❌ Слишком много попыток. Нажмите /start и начните заново.'
                            : '❌ Juda ko\'p noto\'g\'ri urinish. /start ni bosib qayta boshlang.',
                        { reply_markup: { remove_keyboard: true } }
                    );
                    return;
                }
                ses.otpAttempts = attempts;
                sessions.set(tgId, ses);
                await ctx.reply(
                    lang === 'ru'
                        ? `❌ Неверный код. Осталось попыток: ${5 - attempts}`
                        : `❌ Noto'g'ri kod. Qolgan urinish: ${5 - attempts}`
                );
                return;
            }

            ses.step = 'reg_name';
            ses.otpCode = undefined;
            ses.otpExpiry = undefined;
            ses.otpAttempts = 0;
            sessions.set(tgId, ses);

            await ctx.reply(
                `✅ <b>${lang === 'ru' ? 'Телефон подтверждён!' : lang === 'en' ? 'Phone verified!' : 'Telefon tasdiqlandi!'}</b>\n\n` +
                getText('reg_ask_name', lang),
                { parse_mode: 'HTML' }
            );
            return;
        }

        // F.I.Sh. kiritish
        if (ses?.step === 'reg_name') {
            const name = text.trim();
            const lang = ses.lang;

            if (name.length < 3) {
                await ctx.reply(getText('reg_name_too_short', lang), { parse_mode: 'HTML' });
                return;
            }

            if (!ses.phone) {
                ses.step = 'reg_phone';
                sessions.set(tgId, ses);
                await ctx.reply(getText('reg_ask_phone', lang), {
                    parse_mode: 'HTML',
                    reply_markup: sharePhoneKeyboard(lang),
                });
                return;
            }

            try {
                const code = await generateUniqueUserCode();
                const passwordHash = await bcrypt.hash(code, 10);
                const referralCode = `P${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                await prisma.user.create({
                    data: {
                        name,
                        phone: ses.phone,
                        passwordHash,
                        telegramId: tgId,
                        telegramCode: code,
                        telegramVerifiedAt: new Date(),
                        referralCode,
                        role: 'user',
                    },
                });

                ses.step = 'menu';
                sessions.set(tgId, { ...ses, name });

                await ctx.reply(
                    formatText('reg_code_sent', lang, { name, code, phone: ses.phone }),
                    { parse_mode: 'HTML', reply_markup: customerMainKeyboard(lang) }
                );
            } catch (err: any) {
                if (err?.code === 'P2002') {
                    await ctx.reply(getText('reg_phone_taken', lang), { parse_mode: 'HTML' });
                } else {
                    await ctx.reply(lang === 'uz' ? '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.' : '❌ Ошибка. Попробуйте ещё раз.');
                }
            }
            return;
        }

        // Menyu tugmalari
        const lang = await getUserLang(tgId);

        if (text === getText('btn_recycle', lang) || text === getText('btn_recycle', 'uz') || text === getText('btn_recycle', 'ru') || text === getText('btn_recycle', 'en')) {
            sessions.set(tgId, { step: 'location', lang });
            await ctx.reply(getText('recycle_start', lang), { parse_mode: 'HTML', reply_markup: shareLocationKeyboard(lang) });
            return;
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
            return;
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
            return;
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
                return;
            }
            const statusMap: Record<string, string> = {
                new: '🔵', dispatched: '📋', assigned: '🚚', en_route: '🚚', arrived: '📍',
                collecting: '⚖️', completed: '✅', cancelled: '❌',
            };
            const list = myReqs.map(r =>
                `${statusMap[r.status] || '⚪'} <b>#${r.id}</b> — ${r.point?.regionUz || '—'} — ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`
            ).join('\n');
            await ctx.reply(`📋 <b>${lang === 'uz' ? 'Arizalaringiz' : lang === 'ru' ? 'Ваши заявки' : 'Your requests'}:</b>\n\n${list}`, { parse_mode: 'HTML' });
            return;
        }

        // ─── 🌿 PRTS Ballarim tugmasi ─────────────────────────────────────
        if (text === getText('btn_prts', lang) || text === getText('btn_prts', 'uz') || text === getText('btn_prts', 'ru') || text === getText('btn_prts', 'en')) {
            const user = await getUserByTgId(tgId);
            if (!user) {
                await ctx.reply(lang === 'uz' ? '❌ Avval ro\'yxatdan o\'ting. /start bosing.' : '❌ Сначала зарегистрируйтесь. Нажмите /start.');
                return;
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
            return;
        }

        if (text === getText('btn_ai', lang) || text === getText('btn_ai', 'uz') || text === getText('btn_ai', 'ru') || text === getText('btn_ai', 'en')) {
            await ctx.reply(
                lang === 'uz' ? '🤖 AI Assistent tez orada ishga tushadi!' :
                lang === 'ru' ? '🤖 AI Ассистент скоро будет доступен!' :
                '🤖 AI Assistant coming soon!'
            );
            return;
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
            return;
        }

        if (ses?.step === 'location' && !text.startsWith('/')) {
            const l = ses.lang;
            if (text === getText('cancel', l) || text === getText('cancel', 'uz') || text === getText('cancel', 'ru') || text === getText('cancel', 'en')) {
                ses.step = 'menu';
                await ctx.reply(
                    lang === 'uz' ? '❌ Bekor qilindi. Asosiy menyu:' : lang === 'ru' ? '❌ Отменено. Главное меню:' : '❌ Cancelled. Main menu:',
                    { reply_markup: customerMainKeyboard(lang) }
                );
                return;
            }

            ses.lat = 0;
            ses.lng = 0;
            ses.step = 'choose_method';

            await ctx.reply(
                getText('recycle_choose', l),
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [btn(getText('btn_self_delivery', l), 'recycle_self')],
                            [btn(getText('btn_call_truck', l), 'recycle_truck')],
                            [btn(getText('cancel', l), 'recycle_cancel')],
                        ],
                    },
                }
            );
            return;
        }
    });
}
