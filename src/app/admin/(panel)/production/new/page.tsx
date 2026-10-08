import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Notice, PageHeader } from '@/components/admin/ui';
import { WorkOrderForm, type WorkOrderPrefill } from '../WorkOrderForm';

export const metadata = { title: 'Yangi ish buyurtmasi' };

/** Musbat INT4 id, aks holda 0 */
const intId = (v: unknown) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : 0;
};

/** Buyurtmadan: mijoz, telefon, birinchi mahsulot, umumiy soni */
async function fromOrder(id: number): Promise<WorkOrderPrefill | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true } } } }, user: { select: { name: true } } },
  });
  if (!order) return null;
  const lines = order.items.map((it) => `${it.product.name} × ${it.quantity}`);
  return {
    orderId: order.id,
    clientName: order.companyName ?? order.customerName ?? order.user?.name ?? '',
    customerPhone: order.contactPhone,
    productName: order.items[0]?.product.name ?? '',
    quantity: order.items.reduce((s, it) => s + it.quantity, 0) || undefined,
    notes: [`Buyurtma #${order.id}`, lines.length > 1 ? lines.join('\n') : null, order.comment].filter(Boolean).join('\n'),
  };
}

/** Arizadan: ism, telefon, mahsulot/o'lcham/soni/logotip (details) */
async function fromLead(id: number): Promise<WorkOrderPrefill | null> {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return null;
  const details = (lead.details && typeof lead.details === 'object' && !Array.isArray(lead.details) ? lead.details : {}) as Record<string, unknown>;
  const dv = (k: string) => (typeof details[k] === 'string' || typeof details[k] === 'number' ? String(details[k]).trim() : '');
  const product = !dv('product') && lead.productId ? await prisma.product.findUnique({ where: { id: lead.productId }, select: { name: true } }) : null;
  const qty = Number(dv('quantity').replace(/\D/g, ''));
  return {
    leadId: lead.id,
    clientName: [lead.name, lead.company].filter(Boolean).join(', '),
    customerPhone: lead.phone,
    productName: dv('product') || product?.name || '',
    quantity: qty > 0 ? qty : undefined,
    size: dv('size') || null,
    notes: [`Ariza #${lead.id}`, dv('logo') && `Logotip: ${dv('logo')}`, lead.message].filter(Boolean).join('\n'),
  };
}

export default async function NewWorkOrder({ searchParams }: { searchParams: Promise<{ order?: string; lead?: string; error?: string }> }) {
  await requireStaff('production');
  const sp = await searchParams;
  const orderId = intId(sp.order);
  const leadId = intId(sp.lead);
  const prefill = (orderId && (await fromOrder(orderId))) || (leadId && (await fromLead(leadId))) || undefined;
  return (
    <>
      <PageHeader title="Yangi ish buyurtmasi">
        <Link href="/admin/production" className="btn-ghost px-4 py-2 text-sm">← Ro'yxat</Link>
      </PageHeader>
      <Notice show={sp.error === '1'} tone="warn">Mijoz, mahsulot, soni va muddat majburiy</Notice>
      {prefill?.orderId && <Notice show>Buyurtma <Link href={`/admin/orders/${prefill.orderId}`} className="underline">#{prefill.orderId}</Link> asosida to'ldirildi</Notice>}
      {prefill?.leadId && <Notice show>Ariza <Link href={`/admin/leads?open=${prefill.leadId}`} className="underline">#{prefill.leadId}</Link> asosida to'ldirildi</Notice>}
      <WorkOrderForm prefill={prefill} />
    </>
  );
}
