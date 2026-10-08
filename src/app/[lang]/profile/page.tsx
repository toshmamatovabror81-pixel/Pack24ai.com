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
  // Buyurtmalarga berilgan hisob-fakturalar (bekor qilinganlardan tashqari); har buyurtma uchun eng yangisi
  const invoices = orders.length
    ? await prisma.corporateInvoice.findMany({
        where: { orderId: { in: orders.map((o) => o.id) }, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        select: { orderId: true, invoiceNo: true },
      })
    : [];
  const invoiceByOrder = new Map<number, string>();
  for (const i of invoices) if (!invoiceByOrder.has(i.orderId)) invoiceByOrder.set(i.orderId, i.invoiceNo);
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
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-50">
              <Link href={o.accessToken ? `/${locale}/orders/${o.accessToken}` : '#'} className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">#{o.id}</span>
                <span className="text-sm text-slate-500">{formatDate(o.createdAt, locale)}</span>
                <span className="text-sm">{t.order.statuses[statusKey(o.status)]}</span>
                <span className="text-sm">{t.order.paymentStatuses[o.paymentStatus]}</span>
                <span className="font-semibold">{formatPrice(o.totalAmount, t.common.sum)}</span>
              </Link>
              {o.accessToken && invoiceByOrder.has(o.id) && (
                <Link href={`/${locale}/orders/${o.accessToken}/invoice`} className="text-sm text-brand-500 hover:underline">
                  {t.order.invoice} {invoiceByOrder.get(o.id)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
