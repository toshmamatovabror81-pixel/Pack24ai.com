import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { SESSION_COOKIE, signSession, verifySession, STAFF_ROLES, type Role } from './session';
import { can, type Section } from './permissions';

const CUSTOMER_MAX_AGE = 60 * 60 * 24 * 30; // 30 kun
const STAFF_MAX_AGE = 60 * 60 * 12; // 12 soat

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function checkPassword(password: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function startSession(user: { id: number; role: Role; name: string }) {
  const maxAge = STAFF_ROLES.includes(user.role) ? STAFF_MAX_AGE : CUSTOMER_MAX_AGE;
  const token = await signSession({ uid: user.id, role: user.role, name: user.name }, maxAge);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Cookie'dagi sessiya + bazada foydalanuvchi faolligini tekshirish */
export async function currentUser() {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, deletedAt: true, companyName: true, address: true },
  });
  if (!user || !user.isActive || user.deletedAt) return null;
  return user;
}

/** Admin sahifalar va server action'lar uchun: xodim bo'lmasa login'ga */
export async function requireStaff(section?: Section) {
  const user = await currentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) redirect('/admin/login');
  if (section && !can(user.role, section)) redirect('/admin?denied=1');
  return user;
}
