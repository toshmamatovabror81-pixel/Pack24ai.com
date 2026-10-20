import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { currentUser } from '@/lib/auth';
import { AuthForm } from '@/components/forms/AuthForm';
import { loginAction } from './actions';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/login', title: t.auth.login, description: t.meta.description, noindex: true });
}

export default async function LoginPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  if (await currentUser().catch(() => null)) redirect(`/${locale}/profile`);
  return (
    <div className="container-site max-w-md py-12">
      <div className="card p-6">
        <h1 className="h1 mb-6">{t.auth.login}</h1>
        <AuthForm
          action={loginAction}
          locale={locale}
          submit={t.nav.login}
          fields={[
            { name: 'phone', label: t.common.phone, type: 'tel', autoComplete: 'tel' },
            { name: 'password', label: t.auth.password, type: 'password', autoComplete: 'current-password' },
          ]}
          errors={{ invalid: t.auth.invalid, rate: t.common.error }}
        />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.noAccount} <Link href={`/${locale}/register`} className="font-semibold text-brand-500">{t.auth.register}</Link>
        </p>
      </div>
    </div>
  );
}
