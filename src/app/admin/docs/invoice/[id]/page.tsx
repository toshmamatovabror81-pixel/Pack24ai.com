import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { InvoiceDoc } from '@/components/docs/InvoiceDoc';

export const metadata = { title: 'Hisob-faktura' };

/** Chop etiladigan hisob-faktura (admin panel sidebar'siz) */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('finance');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const invoice = await prisma.corporateInvoice.findUnique({
    where: { id },
    include: { order: { include: { items: { include: { product: { select: { name: true, nameI18n: true, sku: true } } } } } } },
  });
  if (!invoice) notFound();
  return <InvoiceDoc invoice={invoice} order={invoice.order} settings={await getSettings()} locale="uz" backHref={`/admin/invoices/${invoice.id}`} />;
}
