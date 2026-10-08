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
  const id = await verifyDriverSession(jar.get(DRIVER_COOKIE)?.value);
  if (!id) return null;
  const driver = await prisma.driver.findUnique({ where: { id }, include: { point: true, supervisor: { select: { id: true, name: true, phone: true } } } });
  if (!driver || driver.status === 'inactive') return null;
  return driver;
}

export async function requireDriver() {
  const d = await currentDriver();
  if (!d) redirect('/driver/login');
  return d;
}
