import { NextResponse } from 'next/server';
import { runTick } from '@/lib/cron';
import { verifyOpsBearer } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

/** Davriy ishlar signali: faqat serverning o'zi (deploy/auto-update.sh) Bearer TELEGRAM_OPS_SECRET bilan chaqiradi */
export async function POST(req: Request) {
  if (!verifyOpsBearer(req)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runTick()) });
  } catch (e) {
    console.error('[cron] tick', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
