import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { availablePaymentMethods } from '@/lib/orders';
import { currentUser } from '@/lib/auth';
import { displayPhone } from '@/lib/format';
import { CheckoutForm } from '@/components/cart/CheckoutForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/checkout', title: t.checkout.title, description: t.meta.description, noindex: true });
}

export default async function CheckoutPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  const user = await currentUser().catch(() => null);
  return (
    <CheckoutForm
      locale={locale}
      methods={availablePaymentMethods()}
      defaults={{ name: user?.name ?? '', phone: user ? displayPhone(user.phone) : '', address: user?.address ?? '' }}
      l={{
        title: t.checkout.title, contact: t.checkout.contact, name: t.common.name, phone: t.common.phone, company: t.common.company,
        deliveryMethod: t.checkout.deliveryMethod, courier: t.checkout.courier, pickup: t.checkout.pickup, address: t.checkout.address,
        comment: t.checkout.comment, paymentMethod: t.checkout.paymentMethod, cash: t.checkout.cash, payme: t.checkout.payme,
        click: t.checkout.click, bank: t.checkout.bank, agree: t.checkout.agree, offer: t.pages.offer, place: t.checkout.place,
        placing: t.checkout.placing, subtotal: t.cart.subtotal, discount: t.cart.discount, delivery: t.cart.delivery, total: t.cart.total,
        promo: t.cart.promo, apply: t.cart.apply, promoInvalid: t.cart.promoInvalid, empty: t.cart.empty, toCatalog: t.home.heroCta,
        currency: t.common.sum, error: t.common.error, required: t.common.required,
      }}
    />
  );
}
