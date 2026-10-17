import type { CorporateInvoice, Order, OrderItem, Product } from '@prisma/client';
import { PrintDoc, PrintScript } from './PrintDoc';
import { displayPhone, formatDate, formatPrice, toNumber } from '@/lib/format';
import { splitVat } from '@/lib/documents';
import type { Locale } from '@/lib/i18n/config';
import { pickText } from '@/lib/i18n/config';
import type { SiteSettings } from '@/lib/settings';

type OrderWithItems = Order & { items: (OrderItem & { product: Pick<Product, 'name' | 'nameI18n' | 'sku'> })[] };

const L: Record<Locale, Record<string, string>> = {
  uz: { title: 'HISOB-FAKTURA', seller: 'Yetkazib beruvchi', buyer: 'Xaridor', inn: 'STIR', bank: 'Bank rekvizitlari', date: 'Sana', due: "To'lov muddati", order: 'Buyurtma', no: '№', item: 'Nomi', sku: 'Artikul', qty: 'Soni', price: 'Narx', sum: 'Summa', delivery: 'Yetkazib berish', discount: 'Chegirma', subtotal: 'QQSsiz summa', vat: 'QQS', total: "Jami to'lovga", director: 'Direktor', accountant: 'Bosh hisobchi', paid: "TO'LANGAN", note: "To'lov maqsadida hisob-faktura raqamini ko'rsating." },
  ru: { title: 'СЧЁТ-ФАКТУРА', seller: 'Поставщик', buyer: 'Покупатель', inn: 'ИНН', bank: 'Банковские реквизиты', date: 'Дата', due: 'Срок оплаты', order: 'Заказ', no: '№', item: 'Наименование', sku: 'Артикул', qty: 'Кол-во', price: 'Цена', sum: 'Сумма', delivery: 'Доставка', discount: 'Скидка', subtotal: 'Сумма без НДС', vat: 'НДС', total: 'Итого к оплате', director: 'Директор', accountant: 'Главный бухгалтер', paid: 'ОПЛАЧЕНО', note: 'В назначении платежа укажите номер счёта.' },
  en: { title: 'INVOICE', seller: 'Supplier', buyer: 'Customer', inn: 'Tax ID', bank: 'Bank details', date: 'Date', due: 'Due date', order: 'Order', no: 'No.', item: 'Item', sku: 'SKU', qty: 'Qty', price: 'Price', sum: 'Amount', delivery: 'Delivery', discount: 'Discount', subtotal: 'Subtotal (excl. VAT)', vat: 'VAT', total: 'Total due', director: 'Director', accountant: 'Chief accountant', paid: 'PAID', note: 'Please quote the invoice number in the payment reference.' },
};

/**
 * Chop etiladigan hisob-faktura. Admin (/admin/docs/invoice/[id]) va mijoz (/[lang]/orders/[token]/invoice) sahifalari
 * bir xil komponentni ishlatadi; narxlar QQS bilan, QQS summadan ajratib ko'rsatiladi.
 */
export function InvoiceDoc({ invoice, order, settings, locale = 'uz', backHref }: { invoice: CorporateInvoice; order: OrderWithItems; settings: SiteSettings; locale?: Locale; backHref?: string }) {
  const t = L[locale];
  const cur = locale === 'ru' ? 'сум' : locale === 'en' ? 'UZS' : "so'm";
  const money = (v: Parameters<typeof formatPrice>[0]) => formatPrice(v, cur);
  const total = toNumber(invoice.totalAmount);
  const { subtotal, vatAmount } = splitVat(total, invoice.vatPercent);
  const buyerName = order.companyName || order.customerName || '—';
  return (
    <PrintDoc title={`${t.title} ${invoice.invoiceNo}`} backHref={backHref}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{t.title} {invoice.invoiceNo}</h1>
          <p className="muted">{t.date}: {formatDate(invoice.createdAt, locale)} · {t.due}: {formatDate(invoice.dueDate, locale)} · {t.order} #{order.id}</p>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>PACK<span style={{ color: '#e33326' }}>24</span></div>
      </div>
      {invoice.status === 'paid' && <p style={{ color: '#059669', fontWeight: 700 }}>{t.paid}{invoice.paidAt ? ` · ${formatDate(invoice.paidAt, locale)}` : ''}</p>}

      <table>
        <tbody>
          <tr>
            <th style={{ width: '50%' }}>{t.seller}</th>
            <th>{t.buyer}</th>
          </tr>
          <tr>
            <td>
              <strong>{settings.legalName || settings.companyName}</strong><br />
              {settings.inn && <>{t.inn}: {settings.inn}<br /></>}
              {pickText(settings.address, locale, '')}<br />
              {displayPhone(settings.phone)}{settings.email && <>, {settings.email}</>}
              {settings.bankDetails && <><br /><span className="muted">{t.bank}:</span><br /><span style={{ whiteSpace: 'pre-line' }}>{settings.bankDetails}</span></>}
            </td>
            <td>
              <strong>{buyerName}</strong><br />
              {order.companyInn && <>{t.inn}: {order.companyInn}<br /></>}
              {order.contactPhone && <>{displayPhone(order.contactPhone)}<br /></>}
              {order.shippingAddress}
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr><th>{t.no}</th><th>{t.item}</th><th>{t.sku}</th><th className="num">{t.qty}</th><th className="num">{t.price}</th><th className="num">{t.sum}</th></tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>{pickText(it.product.nameI18n, locale, it.product.name)}</td>
              <td className="muted">{it.product.sku ?? ''}</td>
              <td className="num">{it.quantity}</td>
              <td className="num">{money(it.price)}</td>
              <td className="num">{money(toNumber(it.price) * it.quantity)}</td>
            </tr>
          ))}
          {toNumber(order.discountAmount) > 0 && (
            <tr><td colSpan={5} className="num">{t.discount}{order.promoCode ? ` (${order.promoCode})` : ''}</td><td className="num">−{money(order.discountAmount)}</td></tr>
          )}
          {toNumber(order.deliveryFee) > 0 && (
            <tr><td colSpan={5} className="num">{t.delivery}</td><td className="num">{money(order.deliveryFee)}</td></tr>
          )}
          <tr><td colSpan={5} className="num">{t.subtotal}</td><td className="num">{money(subtotal)}</td></tr>
          <tr><td colSpan={5} className="num">{t.vat} {invoice.vatPercent}%</td><td className="num">{money(vatAmount)}</td></tr>
          <tr className="total"><td colSpan={5} className="num">{t.total}</td><td className="num">{money(total)}</td></tr>
        </tbody>
      </table>

      <p className="muted">{t.note}</p>
      <div className="sign">
        <div>{t.director}: {settings.directorName || '______________'}</div>
        <div>{t.accountant}: ______________</div>
      </div>
      <PrintScript />
    </PrintDoc>
  );
}
