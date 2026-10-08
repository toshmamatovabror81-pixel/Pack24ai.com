import { Logo } from '@/components/site/Logo';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Kirish' };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center"><Logo className="text-brand-700" /><p className="mt-1 text-sm text-slate-500">Boshqaruv paneli</p></div>
        <LoginForm />
      </div>
    </div>
  );
}
