'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { num, text } from '@/lib/formData';
import { adjustStock, setStock, StockError } from '@/lib/inventory';
import { movementReasons } from '@/components/admin/inventory/status';

/** Ro'yxat sahifasiga filtrlarni saqlab qaytish */
function backTo(fd: FormData, extra: Record<string, string>) {
  const p = new URLSearchParams();
  for (const k of ['q', 'low', 'page']) {
    const v = text(fd, k, 100);
    if (v) p.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return `/admin/inventory?${p}`;
}

function revalidateInventory() {
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/inventory/movements');
  revalidatePath('/admin');
}

/** Bitta mahsulot qoldig'ini ± o'zgartirish */
export async function adjustInventory(fd: FormData) {
  const user = await requireStaff('inventory');
  const productId = Number(fd.get('productId'));
  const delta = Math.trunc(num(fd, 'delta') ?? 0);
  const reasonKey = text(fd, 'reason', 40);
  const reason = Object.hasOwn(movementReasons, reasonKey) ? movementReasons[reasonKey] : movementReasons.boshqa;
  const product = Number.isSafeInteger(productId) && delta ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }) : null;
  if (!product) redirect(backTo(fd, { error: 'input' }));
  try {
    await adjustStock({ productId, delta, reason, createdBy: user.name });
  } catch (e) {
    if (e instanceof StockError) redirect(backTo(fd, { error: 'stock', product: String(productId) }));
    throw e;
  }
  revalidateInventory();
  redirect(backTo(fd, { saved: '1' }));
}

/** Inventarizatsiya: har bir mahsulot uchun haqiqiy sanalgan miqdor, farqi jurnalga yoziladi */
export async function runInventoryCount(fd: FormData) {
  const user = await requireStaff('inventory');
  const counted = new Map<number, number>();
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('qty.')) continue;
    const productId = Number(key.slice(4));
    const raw = String(value).replace(/\s/g, '');
    const qty = Number(raw);
    if (Number.isSafeInteger(productId) && raw !== '' && Number.isFinite(qty) && qty >= 0) counted.set(productId, Math.floor(qty));
  }
  const products = await prisma.product.findMany({ where: { id: { in: [...counted.keys()] } }, select: { id: true } });
  let changed = 0;
  for (const { id } of products) {
    // Farq tranzaksiya ichida hisoblanadi — sanash paytidagi parallel chiqimlar yo'qolmaydi
    const { changed: c } = await setStock({ productId: id, quantity: counted.get(id)!, reason: movementReasons.inventarizatsiya, createdBy: user.name });
    if (c) changed++;
  }
  revalidateInventory();
  redirect(`/admin/inventory?counted=${changed}`);
}
