import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { resolveLocale } from '@/lib/locale';
import { formatDate, formatPrice, toNumber } from '@/lib/format';
import { pickText } from '@/lib/i18n/config';
import { paymentUrl } from '@/lib/orders';
import { statusKey } from '@/lib/orderStatus';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ lang: string; token: string }> };

export default async function OrderPage({ params }: Props) {
  const { locale, t } = await resolveLocale(params);
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({
    where: { accessToken: token },
    include: { items: { include: { product: { select: { name: true, nameI18n: true, image: true } } } } },
  });
  if (!order || order.deletedAt) notFound();
  const pay = order.paymentStatus !== 'paid' && order.status !== 'cancelled' ? paymentUrl(order, locale) : null;
  const sum = (v: Parameters<typeof formatPrice>[0]) => formatPrice(v, t.common.sum);
  return (
    <div className="container-site max-w-3xl py-10">
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <h1 className="h1">{t.order.title} #{order.id}</h1>
            <p className="mt-1 text-slate-600">{t.order.thanks}</p>
            <p className="mt-1 text-sm text-slate-500">{formatDate(order.createdAt, locale, true)}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t.order.status}</dt>
            <dd className="font-semibold">{t.order.statuses[statusKey(order.status)]}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t.order.payment}</dt>
            <dd className="font-semibold">{t.order.paymentStatuses[order.paymentStatus]}</dd>
          </div>
        </dl>
        {pay && (
          <a href={pay} className="btn-accent mt-6 w-full sm:w-auto">{t.order.pay}: {sum(order.totalAmount)}</a>
        )}
        <h2 className="mt-8 font-semibold">{t.order.items}</h2>
        <ul className="mt-3 divide-y divide-slate-200">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-slate-50">
                <Image src={it.product.image || '/images/no-image.svg'} alt="" fill sizes="56px" className="object-contain" />
              </div>
              <span className="flex-1 text-sm">{pickText(it.product.nameI18n, locale, it.product.name)} × {it.quantity}</span>
              <span className="text-sm font-medium">{sum(toNumber(it.price) * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
          {order.subtotal && <div className="flex justify-between"><dt>{t.cart.subtotal}</dt><dd>{sum(order.subtotal)}</dd></div>}
          {toNumber(order.discountAmount) > 0 && <div className="flex justify-between text-emerald-700"><dt>{t.cart.discount}</dt><dd>−{sum(order.discountAmount)}</dd></div>}
          <div className="flex justify-between"><dt>{t.cart.delivery}</dt><dd>{sum(order.deliveryFee)}</dd></div>
          <div className="flex justify-between text-lg font-bold"><dt>{t.cart.total}</dt><dd>{sum(order.totalAmount)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
