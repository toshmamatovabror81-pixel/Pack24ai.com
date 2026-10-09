import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '../db';
import { DRIVER_COOKIE, DRIVER_MAX_AGE, signDriverSession, verifyDriverSession } from './driverSession';

export async function startDriverSession(driverId: number) {
  const token = await signDriverSession(driverId);
  const jar = await cookies();
  jar.set(DRIVER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DRIVER_MAX_AGE });
}

export async function endDriverSession() {
  const jar = await cookies();
  jar.delete(DRIVER_COOKIE);
}

/** Cookie'dagi sessiya + bazada haydovchi faolligi */
export async function currentDriver() {
  const jar = await cookies();
  const session = await verifyDriverSession(jar.get(DRIVER_COOKIE)?.value);
  if (!session) return null;
  const driver = await prisma.driver.findUnique({ where: { id: session.id }, include: { point: true, supervisor: { select: { id: true, name: true, phone: true } } } });
  if (!driver || driver.status === 'inactive') return null;
  // Bot orqali parol yangilangan bo'lsa, undan oldin ochilgan sessiyalar bekor (telefon yo'qolganda himoya)
  if (driver.passwordSetByBotAt && session.issuedAt.getTime() < driver.passwordSetByBotAt.getTime() - 2_000) return null;
  return driver;
}

export async function requireDriver() {
  const d = await currentDriver();
  if (!d) redirect('/driver/login');
  return d;
}
