'use server';

import { redirect } from 'next/navigation';
import { endSession } from '@/lib/auth';

export async function adminLogout() {
  await endSession();
  redirect('/admin/login');
}
