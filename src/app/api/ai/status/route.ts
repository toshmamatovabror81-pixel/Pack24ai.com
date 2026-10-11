import { NextResponse } from 'next/server';
import { aiConfigured, aiCustomerDailyLimit, aiDailyLimit, aiModel, aiRequestsToday, testAi } from '@/lib/ai/client';
import { verifyOpsBearer } from '@/lib/telegram/security';

export const dynamic = 'force-dynamic';

/** AI holati: faqat serverning o'zi (deploy/ai-setup.sh) Bearer TELEGRAM_OPS_SECRET bilan chaqiradi. Kalit hech qachon qaytarilmaydi. */
export async function GET(req: Request) {
  if (!verifyOpsBearer(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, configured: aiConfigured(), model: aiModel(), today: await aiRequestsToday().catch(() => null), dailyLimit: aiDailyLimit(), customerDailyLimit: aiCustomerDailyLimit() });
}

/** Kalit va modelni haqiqiy (juda qisqa) so'rov bilan sinash */
export async function POST(req: Request) {
  if (!verifyOpsBearer(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await testAi();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
