/**
 * verifyDriverToken — Haydovchi mobil ilova tokenini tekshirish
 *
 * Token format: base64(payload).hmac
 * Payload: { driverId, identifier, role: 'driver', ts }
 *
 * Token `/api/auth/driver/login` orqali generatsiya qilinadi.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getDriverTokenSecret } from '@/lib/auth/tokenSecrets';

type DriverTokenPayload = {
    driverId: number;
    identifier: string;
    role: string;
    ts: number;
};

type VerifyResult =
    | { ok: true; driverId: number; driver: { id: number; name: string; phone: string; pointId: number | null; supervisorId: number | null } }
    | { ok: false; error: string };

/**
 * Bearer token'dan driver olish
 *
 * @param authHeader — "Bearer <token>" yoki faqat token
 */
export async function verifyDriverToken(authHeader: string | null): Promise<VerifyResult> {
    if (!authHeader) {
        return { ok: false, error: 'Token kiritilmagan' };
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    if (!token) {
        return { ok: false, error: 'Token bo\'sh' };
    }

    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) {
        return { ok: false, error: 'Token formati noto\'g\'ri' };
    }

    const base64Payload = token.slice(0, dotIndex);
    const receivedHmac = token.slice(dotIndex + 1);

    let payloadStr: string;
    try {
        payloadStr = Buffer.from(base64Payload, 'base64').toString('utf-8');
    } catch {
        return { ok: false, error: 'Token decode xatosi' };
    }

    const expectedHmac = crypto
        .createHmac('sha256', getDriverTokenSecret())
        .update(payloadStr)
        .digest('hex');

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

    let payload: DriverTokenPayload;
    try {
        payload = JSON.parse(payloadStr);
    } catch {
        return { ok: false, error: 'Token payload xatosi' };
    }

    if (!payload.driverId || !Number.isFinite(payload.driverId) || payload.role !== 'driver') {
        return { ok: false, error: 'Token ichida driverId yo\'q yoki role notog\'ri' };
    }

    const driver = await prisma.driver.findUnique({
        where: { id: payload.driverId },
        select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            pointId: true,
            supervisorId: true,
        },
    });

    if (!driver) {
        return { ok: false, error: 'Haydovchi topilmadi' };
    }

    if (driver.status === 'inactive') {
        return { ok: false, error: 'Hisob faol emas' };
    }

    return {
        ok: true,
        driverId: driver.id,
        driver: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            pointId: driver.pointId,
            supervisorId: driver.supervisorId,
        },
    };
}
