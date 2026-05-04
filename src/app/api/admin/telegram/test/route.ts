import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomerBot } from '@/lib/telegram/botManager';
import { isAuthorizedTelegramOpsRequest } from '@/lib/telegram/security';


export async function POST(request: NextRequest) {
    try {
        const authorized = await isAuthorizedTelegramOpsRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = await prisma.telegramConfig.findFirst();

        if (!config || !config.botToken) {
            return NextResponse.json({ error: 'Bot token topilmadi' }, { status: 400 });
        }

        const bot = await getCustomerBot();
        if (!bot) {
            return NextResponse.json({ error: 'Botni ishga tushirib bo\'lmadi' }, { status: 500 });
        }

        const me = await bot.telegram.getMe();
        
        // Test message to salesChatId
        if (config.salesChatId) {
            const chatIds = config.salesChatId.split(',').map(id => id.trim());
            const results = [];

            for (const chatId of chatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, `🔔 *PACK24 AI Test Xabari*\n\nBot muvaffaqiyatli ulandi!\nBot: @${me.username}\nHolat: Faol ✅`, { parse_mode: 'Markdown' });
                    results.push({ chatId, status: 'success' });
                } catch (err: any) {
                    results.push({ chatId, status: 'error', message: err.message });
                }
            }
            
            return NextResponse.json({ 
                message: 'Test yakunlandi', 
                bot: `@${me.username}`,
                results 
            });
        }

        return NextResponse.json({ 
            message: 'Bot ishlamoqda, lekin salesChatId kiritilmagan', 
            bot: `@${me.username}` 
        });

    } catch (error: any) {
        console.error('Test error:', error);
        return NextResponse.json({ error: error.message || 'Xatolik yuz berdi' }, { status: 500 });
    }
}
