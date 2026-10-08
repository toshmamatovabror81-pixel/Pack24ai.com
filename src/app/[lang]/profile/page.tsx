import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { resolveLocale, type LangParams } from '@/lib/locale';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { statusKey } from '@/lib/orderStatus';
import { logoutAction } from '../login/actions';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'user') redirect('/admin');
  const orders = await prisma.order.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 });
  return (
    <div className="container-site max-w-4xl py-10">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="h1">{user.name}</h1>
          <p className="text-slate-600">{displayPhone(user.phone)}{user.companyName && ` · ${user.companyName}`}</p>
        </div>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button className="btn-ghost">{t.auth.logout}</button>
        </form>
      </div>
      <h2 className="mb-3 mt-8 text-xl font-bold">{t.auth.myOrders}</h2>
      {orders.length === 0 ? (
        <p className="text-slate-500">{t.auth.noOrders}</p>
      ) : (
        <ul className="card divide-y divide-slate-200">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={o.accessToken ? `/${locale}/orders/${o.accessToken}` : '#'} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-50">
                <span className="font-semibold">#{o.id}</span>
                <span className="text-sm text-slate-500">{formatDate(o.createdAt, locale)}</span>
                <span className="text-sm">{t.order.statuses[statusKey(o.status)]}</span>
                <span className="text-sm">{t.order.paymentStatuses[o.paymentStatus]}</span>
                <span className="font-semibold">{formatPrice(o.totalAmount, t.common.sum)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
