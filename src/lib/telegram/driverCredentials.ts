/**
 * Driver kredensiallari (parol va kod) generatsiyasi.
 *
 * Bot orqali haydovchini ro'yxatdan o'tkazganda parol va 5 raqamli kodni yaratib,
 * `Driver.passwordHash` va `Driver.registrationCode` ga saqlaydi.
 * Audit: kim taqdim etgani, qaysi punkt orqali olingani — `invitedBy*` maydonlari.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateUniqueTelegramRegistrationCode } from './registrationCodes';

const PASSWORD_LENGTH = 8;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Inson-o'qiy parol (8 belgi, 0/O/1/l/I qabul qilinmaydi).
 */
export function generateReadablePassword(length = PASSWORD_LENGTH): string {
    const chars: string[] = [];
    const alphabetLength = PASSWORD_ALPHABET.length;
    const maxValidByte = 255 - (256 % alphabetLength);
    const temp = new Uint8Array(1);
    while (chars.length < length) {
        globalThis.crypto.getRandomValues(temp);
        const b = temp[0];
        if (b <= maxValidByte) {
            chars.push(PASSWORD_ALPHABET[b % alphabetLength]);
        }
    }
    return chars.join('');
}

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
}

export interface DriverCredentials {
    code: string;            // 5 raqamli kod
    password: string;        // Plain text (faqat bir marta, foydalanuvchiga ko'rsatish uchun)
    passwordHash: string;    // bcrypt hash (DBga saqlash uchun)
}

export async function generateDriverCredentials(): Promise<DriverCredentials> {
    const code = await generateUniqueTelegramRegistrationCode();
    const password = generateReadablePassword();
    const passwordHash = await hashPassword(password);
    return { code, password, passwordHash };
}

export interface IssuedDriverCredentials extends DriverCredentials {
    issuedBySupervisorId: number | null;
    issuedByPointId: number | null;
}

/**
 * Haydovchiga kredensiallarni saqlash va audit yozish.
 *
 * @param driverId — Driver ID
 * @param ctx — kim/qaysi punkt taqdim etgani
 */
export async function persistDriverCredentials(driverId: number, ctx: {
    issuedBySupervisorId?: number | null;
    issuedByPointId?: number | null;
}): Promise<IssuedDriverCredentials> {
    const { code, password, passwordHash } = await generateDriverCredentials();
    const now = new Date();

    await prisma.driver.update({
        where: { id: driverId },
        data: {
            registrationCode: code,
            passwordHash,
            passwordSetByBotAt: now,
            invitedBySupervisorId: ctx.issuedBySupervisorId ?? undefined,
            invitedByPointId: ctx.issuedByPointId ?? undefined,
            invitedAt: now,
        },
    });

    return {
        code,
        password,
        passwordHash,
        issuedBySupervisorId: ctx.issuedBySupervisorId ?? null,
        issuedByPointId: ctx.issuedByPointId ?? null,
    };
}

/**
 * Foydalanuvchiga ko'rsatish uchun chiroyli HTML xabar.
 */
export function formatDriverCredentialsMessage(args: {
    name: string;
    phone: string;
    code: string;
    password: string;
    supervisorName?: string | null;
    pointRegion?: string | null;
    pointCity?: string | null;
}): string {
    const lines: string[] = [];
    lines.push(`✅ <b>Tabriklaymiz, ${args.name}!</b>`);
    lines.push("");
    lines.push("Siz haydovchi sifatida ro'yxatdan o'tdingiz.");
    lines.push("");
    lines.push("🔐 <b>Kirish ma'lumotlaringiz:</b>");
    lines.push(`👤 ID (login): <code>${args.phone}</code>`);
    lines.push(`🔑 Parol: <code>${args.password}</code>`);
    lines.push(`🎫 5 raqamli kod: <code>${args.code}</code>`);
    lines.push("");

    if (args.supervisorName || args.pointRegion) {
        lines.push("📍 <b>Tasdiqlash quyidagi tomondan berildi:</b>");
        if (args.pointRegion) {
            const place = [args.pointRegion, args.pointCity].filter(Boolean).join(', ');
            lines.push(`🏭 Baza: ${place}`);
        }
        if (args.supervisorName) {
            lines.push(`👨‍💼 Mas'ul: ${args.supervisorName}`);
        }
        lines.push("");
    }

    lines.push("⚠️ <b>Parolingizni xavfsiz saqlang.</b>");
    lines.push("Pack24 Driver ilovasiga telefon raqami va parol orqali kira olasiz.");
    lines.push("Yoki shu botda ishlashda davom etishingiz mumkin.");

    return lines.join('\n');
}
