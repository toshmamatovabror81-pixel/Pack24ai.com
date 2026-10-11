import type { Category, Product } from '@prisma/client';
import { Field, I18nFields } from '@/components/admin/ui';
import { ImageInput } from '@/components/admin/ImageInput';
import { parseTiers } from '@/lib/pricing';
import { toNumber } from '@/lib/format';
import { saveProduct } from './actions';

export function ProductForm({ product, categories, stock }: { product?: Product | null; categories: Category[]; stock?: number | null }) {
  const nameI18n = (product?.nameI18n && Object.keys(product.nameI18n as object).length ? product.nameI18n : { uz: product?.name ?? '' }) as Record<string, string>;
  const descI18n = (product?.descriptionI18n && Object.keys(product.descriptionI18n as object).length ? product.descriptionI18n : { uz: product?.description ?? '' }) as Record<string, string>;
  const specs = product?.specifications && typeof product.specifications === 'object' && !Array.isArray(product.specifications)
    ? Object.entries(product.specifications as Record<string, unknown>).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => `${k}: ${v}`).join('\n')
    : '';
  const tiers = parseTiers(product?.priceTiers).map((t) => `${t.minQty}: ${t.price}`).join('\n');
  const gallery = Array.isArray(product?.gallery) ? (product.gallery as unknown[]).filter((g) => typeof g === 'string').join('\n') : '';
  return (
    <form action={saveProduct} className="card grid gap-4 p-5 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <I18nFields name="name" label="Nomi *" value={nameI18n} required />
      <Field label="Narx, so'm *"><input name="price" required inputMode="decimal" defaultValue={product ? toNumber(product.price) : ''} className="input" /></Field>
      <Field label="Eski narx (chizilgan)" hint="Bo'sh qoldirsa ko'rinmaydi"><input name="originalPrice" inputMode="decimal" defaultValue={product?.originalPrice ? toNumber(product.originalPrice) : ''} className="input" /></Field>
      <Field label="Kategoriya">
        <select name="categoryId" defaultValue={product?.categoryId ?? ''} className="input">
          <option value="">—</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Artikul (SKU)"><input name="sku" defaultValue={product?.sku ?? ''} className="input" /></Field>
      <Field label="Minimal buyurtma, dona"><input name="minQuantity" type="number" min={1} defaultValue={product?.minQuantity ?? 1} className="input" /></Field>
      <Field label="Ombordagi qoldiq, dona" hint="Asosiy ombor"><input name="stock" type="number" defaultValue={stock ?? ''} className="input" /></Field>
      <Field label="Holat">
        <select name="status" defaultValue={product?.status ?? 'active'} className="input">
          <option value="active">Sotuvda</option>
          <option value="draft">Qoralama (saytda ko'rinmaydi)</option>
          <option value="archived">Arxiv</option>
        </select>
      </Field>
      <div className="flex items-end gap-6 pb-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="inStock" defaultChecked={product?.inStock ?? true} /> Mavjud</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} /> Bosh sahifada</label>
      </div>
      <Field label="Asosiy rasm" wide><ImageInput name="image" defaultValue={product?.image} folder="products" /></Field>
      <Field label="Qo'shimcha rasmlar" hint="Har qatorda bitta URL" wide><textarea name="gallery" rows={3} defaultValue={gallery} className="input font-mono text-xs" /></Field>
      <I18nFields name="description" label="Tavsif (Markdown: **qalin**, - ro'yxat)" value={descI18n} textarea rows={5} />
      <Field label="Xususiyatlar" hint="Har qatorda: Nomi: qiymat (masalan, Material: Gofrokarton)"><textarea name="specs" rows={5} defaultValue={specs} className="input" /></Field>
      <Field label="Ulgurji narxlar" hint="Har qatorda: soni: dona narxi (masalan, 100: 1200)"><textarea name="tiers" rows={5} defaultValue={tiers} className="input" /></Field>
      <div className="sm:col-span-2"><button className="btn-primary">Saqlash</button></div>
    </form>
  );
}
