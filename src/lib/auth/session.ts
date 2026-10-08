import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'p24_session';
export type Role = 'user' | 'staff' | 'manager' | 'admin';
export type SessionPayload = { uid: number; role: Role; name: string };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET kamida 32 belgi bo\'lishi kerak');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, maxAgeSec: number): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.uid))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSec)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    const uid = Number(payload.sub);
    const role = payload.role as Role;
    if (!Number.isSafeInteger(uid) || !['user', 'staff', 'manager', 'admin'].includes(role)) return null;
    return { uid, role, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

export const STAFF_ROLES: Role[] = ['staff', 'manager', 'admin'];
