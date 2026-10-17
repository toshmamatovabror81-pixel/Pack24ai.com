import Link from 'next/link';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { AuthForm } from '@/components/forms/AuthForm';
import { registerAction } from '../login/actions';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/register', title: t.auth.register, description: t.meta.description, noindex: true });
}

export default async function RegisterPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <div className="container-site max-w-md py-12">
      <div className="card p-6">
        <h1 className="h1 mb-6">{t.auth.register}</h1>
        <AuthForm
          action={registerAction}
          locale={locale}
          submit={t.auth.register}
          fields={[
            { name: 'name', label: t.common.name, autoComplete: 'name' },
            { name: 'phone', label: t.common.phone, type: 'tel', autoComplete: 'tel' },
            { name: 'company', label: t.common.company, autoComplete: 'organization', required: false },
            { name: 'password', label: t.auth.password, type: 'password', autoComplete: 'new-password' },
            { name: 'password2', label: t.auth.password2, type: 'password', autoComplete: 'new-password' },
          ]}
          errors={{ invalid: t.common.error, exists: t.auth.exists, mismatch: t.auth.mismatch, short: t.auth.short, phone: `${t.common.phone}: ${t.common.required}`, name: `${t.common.name}: ${t.common.required}`, rate: t.common.error }}
        />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.haveAccount} <Link href={`/${locale}/login`} className="font-semibold text-brand-500">{t.nav.login}</Link>
        </p>
      </div>
    </div>
  );
}
