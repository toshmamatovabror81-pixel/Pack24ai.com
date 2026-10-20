import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveLocale } from '@/lib/locale';
import { getSettings } from '@/lib/settings';
import { InvoiceDoc } from '@/components/docs/InvoiceDoc';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.order.invoice, robots: { index: false, follow: false } };
}

/** Mijoz uchun hisob-faktura: buyurtma sahifasidagi maxfiy token orqali ochiladi, chop etish / PDF */
export default async function OrderInvoicePage({ params }: Props) {
  const { locale } = await resolveLocale(params);
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const order = await prisma.order.findUnique({
    where: { accessToken: token },
    include: { items: { include: { product: { select: { name: true, nameI18n: true, sku: true } } } } },
  });
  if (!order || order.deletedAt) notFound();
  const [invoice, settings] = await Promise.all([
    prisma.corporateInvoice.findFirst({ where: { orderId: order.id, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } }),
    getSettings(),
  ]);
  if (!invoice) notFound();
  return (
    <div className="print-only-content">
      <InvoiceDoc invoice={invoice} order={order} settings={settings} locale={locale} backHref={`/${locale}/orders/${token}`} />
    </div>
  );
}
