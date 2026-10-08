import { SignJWT, jwtVerify } from 'jose';

/** Haydovchi kabineti (/driver) sessiyasi — admin sessiyasidan alohida cookie va alohida `aud`. */
export const DRIVER_COOKIE = 'p24_driver';
export const DRIVER_MAX_AGE = 60 * 60 * 24 * 30; // 30 kun
const AUD = 'pack24-driver';

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET kamida 32 belgi bo'lishi kerak");
  return new TextEncoder().encode(secret);
}

export async function signDriverSession(driverId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(driverId))
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + DRIVER_MAX_AGE)
    .sign(secretKey());
}

export async function verifyDriverSession(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'], audience: AUD });
    const id = Number(payload.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
