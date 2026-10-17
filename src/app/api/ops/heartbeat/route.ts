import { NextResponse } from 'next/server';
import { alertChats, OPS_FACTS, saveOps } from '@/lib/ops';
import { verifyOpsBearer } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

/**
 * Server kuzatuvi signali: faqat serverning o'zi (deploy/watchdog.sh) Bearer TELEGRAM_OPS_SECRET bilan chaqiradi.
 * Server faktlarini saqlaydi va nosozlik xabarlarini oladigan administratorlarning Telegram ID larini qaytaradi.
 */
export async function POST(req: Request) {
  if (!verifyOpsBearer(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const facts = OPS_FACTS.safeParse(await req.json().catch(() => null));
  if (!facts.success) return NextResponse.json({ ok: false, error: 'bad facts' }, { status: 400 });
  try {
    await saveOps(facts.data);
    return NextResponse.json({ ok: true, alertChats: await alertChats() });
  } catch (e) {
    console.error('[ops] heartbeat', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
