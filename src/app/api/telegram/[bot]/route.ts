import { NextResponse } from 'next/server';
import { isBotKind, botToken } from '@/lib/telegram/bots';
import { verifyWebhook } from '@/lib/telegram/security';
import { dispatchUpdate } from '@/lib/telegram/handlers';
import type { TgUpdate } from '@/lib/telegram/api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ bot: string }> };

/** Telegram webhook: /api/telegram/customer | driver | supervisor (boshqaruv: masul + rahbariyat) */
export async function POST(req: Request, { params }: Params) {
  const { bot } = await params;
  if (!isBotKind(bot)) return NextResponse.json({ ok: false }, { status: 404 });
  if (!verifyWebhook(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!botToken(bot)) return NextResponse.json({ ok: false, error: 'bot not configured' }, { status: 503 });
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await dispatchUpdate(bot, update);
  } catch (e) {
    // Telegram xato javobda update'ni qayta-qayta yuboradi; shuning uchun har doim 200
    console.error(`[webhook:${bot}]`, e);
  }
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: Params) {
  const { bot } = await params;
  if (!isBotKind(bot)) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, bot, configured: !!botToken(bot) });
}
