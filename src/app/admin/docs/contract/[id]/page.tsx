import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { DEFAULT_CONTRACT_TEXT, fillTemplate } from '@/lib/documents';
import { displayPhone, formatDate, formatPrice } from '@/lib/format';
import { pickText } from '@/lib/i18n/config';
import { PrintDoc, PrintScript } from '@/components/docs/PrintDoc';
import { Markdown } from '@/components/site/Markdown';

export const metadata = { title: 'Shartnoma' };

/** Markdown komponenti sarlavhani faqat alohida blokda taniydi: sarlavhadan oldin va keyin bo'sh qator qo'shamiz */
const withHeadingGaps = (md: string) =>
  md
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n(#{1,3} )/g, '$1\n\n$2')
    .replace(/^(#{1,3} [^\n]*)\n(?!\n)/gm, '$1\n\n');

/** Chop etiladigan shartnoma: Sozlamalar'dagi Markdown shablon + shartnoma rekvizitlari */
export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('finance');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const c = await prisma.contract.findUnique({ where: { id } });
  if (!c) notFound();
  const s = await getSettings();
  const vars = {
    contractNo: c.contractNo,
    date: formatDate(c.startDate, 'uz'),
    sellerName: s.legalName || s.companyName,
    sellerInn: s.inn,
    sellerDirector: s.directorName,
    sellerAddress: pickText(s.address, 'uz', ''),
    sellerBank: s.bankDetails,
    company: c.companyName,
    inn: c.inn,
    director: c.directorName,
    address: c.address,
    phone: c.phone ? displayPhone(c.phone) : '',
    bankName: c.bankName,
    mfo: c.mfo,
    bankAccount: c.bankAccount,
    creditLimit: formatPrice(c.creditLimit, '').trim(),
    paymentTermDays: c.paymentTermDays,
    vatPercent: s.vatPercent,
    endDate: c.endDate ? formatDate(c.endDate, 'uz') : '1 yil',
  };
  return (
    <PrintDoc title={`Shartnoma ${c.contractNo}`} backHref={`/admin/contracts/${c.id}`}>
      <Markdown source={withHeadingGaps(fillTemplate(s.contractText || DEFAULT_CONTRACT_TEXT, vars))} className="contract-md" />
      <style>{`
        .contract-md{font-size:13px;line-height:1.55}
        .contract-md h2{font-size:18px;text-align:center;margin:0 0 12px}
        .contract-md h3{font-size:14px;margin:16px 0 6px}
        .contract-md p{margin:0 0 8px;text-align:justify}
      `}</style>
      <PrintScript />
    </PrintDoc>
  );
}
