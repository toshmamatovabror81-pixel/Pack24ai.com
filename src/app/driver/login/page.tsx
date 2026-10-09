import { redirect } from 'next/navigation';
import { currentDriver } from '@/lib/auth/driver';
import { Logo } from '@/components/site/Logo';
import { LoginForm } from '@/components/driver/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kirish' };

export default async function DriverLoginPage() {
  if (await currentDriver()) redirect('/driver');
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <Logo className="text-brand-700" />
          <p className="mt-1 text-sm text-slate-500">Haydovchi kabineti</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
