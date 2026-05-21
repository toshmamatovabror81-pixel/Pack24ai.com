/**
 * verifyMobileToken — Mobil ilova tokenini tekshirish
 * 
 * Token format: base64(payload).hmac
 * Payload: { userId, phone, ts }
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getMobileUserTokenSecret } from '@/lib/auth/tokenSecrets';

type TokenPayload = {
    userId: number;
    phone: string;
    ts: number;
};

type VerifyResult =
    | { ok: true; userId: number; user: { id: number; name: string; phone: string; role: string; ecoPoints: number } }
    | { ok: false; error: string };

/**
 * Bearer token'dan user olish
 * 
 * @param authHeader — "Bearer <token>" yoki faqat token
 */
export async function verifyMobileToken(authHeader: string | null): Promise<VerifyResult> {
    if (!authHeader) {
        return { ok: false, error: 'Token kiritilmagan' };
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    if (!token) {
        return { ok: false, error: 'Token bo\'sh' };
    }

    // Parse token: base64payload.hmac
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) {
        return { ok: false, error: 'Token formati noto\'g\'ri' };
    }

    const base64Payload = token.slice(0, dotIndex);
    const receivedHmac = token.slice(dotIndex + 1);

    // HMAC tekshirish
    let payloadStr: string;
    try {
        payloadStr = Buffer.from(base64Payload, 'base64').toString('utf-8');
    } catch {
        return { ok: false, error: 'Token decode xatosi' };
    }

    const expectedHmac = crypto
        .createHmac('sha256', getMobileUserTokenSecret())
        .update(payloadStr)
        .digest('hex');

    // Length tekshiruv — timingSafeEqual length farqida exception tashlaydi
    let receivedBuf: Buffer;
    let expectedBuf: Buffer;
    try {
        receivedBuf = Buffer.from(receivedHmac, 'hex');
        expectedBuf = Buffer.from(expectedHmac, 'hex');
    } catch {
        return { ok: false, error: 'Token imzosi formati noto\'g\'ri' };
    }
    if (receivedBuf.length !== expectedBuf.length) {
        return { ok: false, error: 'Token imzosi noto\'g\'ri' };
    }
    if (!crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
        return { ok: false, error: 'Token imzosi noto\'g\'ri' };
    }

    // Payload parse
    let payload: TokenPayload;
    try {
        payload = JSON.parse(payloadStr);
    } catch {
        return { ok: false, error: 'Token payload xatosi' };
    }

    if (!payload.userId || !Number.isFinite(payload.userId)) {
        return { ok: false, error: 'Token ichida userId yo\'q' };
    }

    // DB'dan user olish
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            ecoPoints: true,
        },
    });

    if (!user) {
        return { ok: false, error: 'Foydalanuvchi topilmadi' };
    }

    if (!user.isActive) {
        return { ok: false, error: 'Hisob faol emas' };
    }

    return {
        ok: true,
        userId: user.id,
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            ecoPoints: user.ecoPoints ?? 0,
        },
    };
}
