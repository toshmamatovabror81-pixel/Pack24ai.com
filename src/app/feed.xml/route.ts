import { prisma } from '@/lib/db';
import { productHref } from '@/lib/catalog';
import { pickText } from '@/lib/i18n/config';
import { toNumber } from '@/lib/format';
import { siteUrl } from '@/lib/site';

// Google Merchant Center va Yandex uchun mahsulot fidi (RSS 2.0 + g: nomlar fazosi)
export const revalidate = 3600;

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
const plain = (s: string) => s.replace(/[*#_[\]()`>]/g, '').replace(/\s+/g, ' ').trim();

export async function GET() {
  const products = await prisma.product.findMany({ where: { status: 'active' }, include: { categoryRel: true }, orderBy: { id: 'asc' } });
  const base = siteUrl();
  const items = products
    .map((p) => {
      const name = pickText(p.nameI18n, 'ru', p.name);
      const desc = plain(pickText(p.descriptionI18n, 'ru', p.description ?? '') || name).slice(0, 4900);
      const image = p.image?.startsWith('http') ? p.image : `${base}${p.image || '/images/no-image.svg'}`;
      return `<item>
<g:id>${p.id}</g:id>
<title>${esc(name)}</title>
<description>${esc(desc)}</description>
<link>${esc(`${base}${productHref('ru', p.id, pickText(p.nameI18n, 'uz', p.name))}`)}</link>
<g:image_link>${esc(image)}</g:image_link>
<g:availability>${p.inStock ? 'in_stock' : 'preorder'}</g:availability>
<g:price>${toNumber(p.price).toFixed(2)} UZS</g:price>
<g:condition>new</g:condition>
<g:brand>Pack24</g:brand>
${p.sku ? `<g:mpn>${esc(p.sku)}</g:mpn>` : '<g:identifier_exists>no</g:identifier_exists>'}
${p.categoryRel ? `<g:product_type>${esc(pickText(p.categoryRel.nameI18n, 'ru', p.categoryRel.name))}</g:product_type>` : ''}
${p.minQuantity > 1 ? `<g:min_handling_time>1</g:min_handling_time>` : ''}
</item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Pack24</title>
<link>${base}</link>
<description>Pack24 упаковка</description>
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
