import Link from 'next/link';
import { SiteImage as Image } from '@/components/site/SiteImage';
import type { ProductCard as Card } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { AddToCartButton } from '../cart/AddToCartButton';

export function ProductCard({ p, currency, labels }: { p: Card; currency: string; labels: { add: string; added: string; minQty: string; pcs: string } }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-lg">
      <Link href={p.href} className="relative block aspect-square bg-slate-50">
        <Image src={p.image} alt={p.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-3 transition group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-800">
          <Link href={p.href} className="hover:text-brand-500">{p.name}</Link>
        </h3>
        <div className="mt-auto">
          <p className="text-lg font-bold text-slate-900">
            {formatPrice(p.price, currency)}
            {p.originalPrice && p.originalPrice > p.price && (
              <span className="ml-2 text-sm font-normal text-slate-400 line-through">{formatPrice(p.originalPrice, currency)}</span>
            )}
          </p>
          {p.minQuantity > 1 && <p className="text-xs text-slate-500">{labels.minQty}: {p.minQuantity} {labels.pcs}</p>}
        </div>
        <AddToCartButton
          item={{ productId: p.id, name: p.name, image: p.image, price: p.price, minQuantity: p.minQuantity, href: p.href }}
          label={labels.add}
          addedLabel={labels.added}
          compact
        />
      </div>
    </article>
  );
}
