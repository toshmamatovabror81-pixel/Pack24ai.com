import { resolveLocale, type LangParams } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { CartView } from '@/components/cart/CartView';

export async function generateMetadata({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return pageMetadata({ locale, path: '/cart', title: t.cart.title, description: t.meta.description, noindex: true });
}

export default async function CartPage({ params }: LangParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <CartView
      locale={locale}
      l={{
        title: t.cart.title, empty: t.cart.empty, emptyText: t.cart.emptyText, total: t.cart.total, subtotal: t.cart.subtotal,
        delivery: t.cart.delivery, discount: t.cart.discount, checkout: t.cart.checkout, remove: t.cart.remove,
        toCatalog: t.home.heroCta, currency: t.common.sum, minQty: t.product.minQty,
      }}
    />
  );
}
