import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { verifyOpsBearer } from '@/lib/telegram/security';
import { botStatuses, removeWebhooks, setupWebhooks } from '@/lib/telegram/setup';

export const dynamic = 'force-dynamic';

/** Faqat admin (sessiya) yoki Bearer TELEGRAM_OPS_SECRET */
async function authorized(req: Request) {
  if (verifyOpsBearer(req)) return true;
  const u = await currentUser().catch(() => null);
  return u?.role === 'admin';
}

export async function GET(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, bots: await botStatuses() });
}

/** Webhook'larni o'rnatish: body {baseUrl?} (standart: APP_URL) */
export async function POST(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { baseUrl?: string };
  try {
    const results = await setupWebhooks(typeof body.baseUrl === 'string' && body.baseUrl ? body.baseUrl : undefined);
    return NextResponse.json({ ok: results.every((r) => r.ok), results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  await removeWebhooks();
  return NextResponse.json({ ok: true });
}
