'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { MaterialType, PickupType, RecyclePointStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { bool, num, optText, text } from '@/lib/formData';
import { normalizePhone } from '@/lib/format';
import { acceptAtBase, adminFixCollection, recordPayment, recordWeighing } from '@/lib/recycling/collections';
import { driverTasks } from '@/lib/recycling/driverTasks';
import { logEvent } from '@/lib/recycling/events';
import { isValidLat, isValidLng } from '@/lib/recycling/geo';
import { assignDriver, cancelRequest, createRequest, dispatchToSupervisor, RequestError, transition, type Actor } from '@/lib/recycling/requests';
import { createDriver, createSupervisor, issueDriverCredentials, resetDriverTelegram, resetSupervisorTelegram, StaffError, updateDriver, updateSupervisor } from '@/lib/recycling/staff';
import { ACTIVE_STATUSES, isMaterial } from '@/lib/recycling/statuses';
import { addBonus, WalletError } from '@/lib/recycling/wallet';
import { isPointColor } from '@/components/admin/recycling/pointColors';
import { POINT_LINK_COUNTS, pointLinkedCount } from '@/components/admin/recycling/helpers';

/**
 * Admin: makulatura arizalari, punktlar, masullar, haydovchilar.
 * Holat faqat poydevor funksiyalari orqali o'zgaradi (transition jadvali). Xatolar ?error=... bilan sahifaga qaytadi.
 * Yaratish formalari (ariza/masul/haydovchi) useActionState bilan ishlaydi: xato va kiritilgan qiymatlar javobda qaytadi,
 * shaxsiy ma'lumot (ism, telefon, manzil) URL ga tushmaydi.
 */

const BASE = '/admin/recycling';

function errMsg(e: unknown): string {
  if (e instanceof RequestError || e instanceof StaffError || e instanceof WalletError) return e.message;
  console.error('[admin/recycling]', e);
  return "Xato yuz berdi. Qayta urinib ko'ring";
}
const withError = (path: string, e: unknown) => `${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(errMsg(e))}`;

async function actor(): Promise<Actor> {
  const u = await requireStaff('recycling');
  return { kind: 'admin', id: u.id, name: u.name };
}

const idOf = (fd: FormData, name = 'id'): number => {
  const n = Number(fd.get(name));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};
const materialOf = (fd: FormData): MaterialType | null => {
  const v = text(fd, 'material', 20);
  return isMaterial(v) ? v : null;
};

/** useActionState formalari: xato bo'lsa xabar + kiritilgan qiymatlar (forma qayta to'ldiriladi) */
export type FormState = { error: string; values: Record<string, string> } | null;
const formValues = (fd: FormData, keys: string[]): Record<string, string> => Object.fromEntries(keys.map((k) => [k, text(fd, k, 500)]));

// ─── Arizalar ────────────────────────────────────────────────────────────────

const REQUEST_FIELDS = ['name', 'phone', 'pointId', 'material', 'volume', 'pickupType', 'address', 'note', 'lat', 'lng'];

export async function createRequestForm(_prev: FormState, fd: FormData): Promise<FormState> {
  await actor();
  const name = text(fd, 'name', 100);
  const phone = text(fd, 'phone', 30);
  const pointId = idOf(fd, 'pointId') || null;
  const material = materialOf(fd);
  const volume = num(fd, 'volume');
  const pickupType: PickupType = fd.get('pickupType') === 'pickup' ? 'pickup' : 'base';
  const address = optText(fd, 'address', 400);
  const note = optText(fd, 'note', 300);
  const lat = num(fd, 'lat');
  const lng = num(fd, 'lng');
  const hasCoords = isValidLat(lat) && isValidLng(lng);
  let id: number;
  try {
    // Arizada alohida izoh maydoni yo'q — izoh manzilga qo'shiladi (masul/haydovchi kartasida ko'rinadi) va hodisaga yoziladi
    const fullAddress = [address, note ? `Izoh: ${note}` : null].filter(Boolean).join('. ') || null;
    const { request } = await createRequest({
      name, phone, pointId, material, volume, pickupType,
      address: fullAddress,
      pickupLat: hasCoords ? lat : null,
      pickupLng: hasCoords ? lng : null,
      pickupLocationMode: pickupType === 'pickup' ? (hasCoords ? 'map' : 'text') : null,
      source: 'admin',
    });
    if (note) await logEvent({ sourceBot: 'platform', eventType: 'admin_note', title: `Ariza #${request.id}: admin izohi`, message: note, requestId: request.id, pointId: request.pointId });
    id = request.id;
  } catch (e) {
    return { error: errMsg(e), values: formValues(fd, REQUEST_FIELDS) };
  }
  revalidatePath(BASE);
  redirect(`${BASE}/requests/${id}?saved=1`);
}

async function requestAction(fd: FormData, run: (id: number, by: Actor) => Promise<void>) {
  const by = await actor();
  const id = idOf(fd);
  if (!id) redirect(BASE);
  const page = `${BASE}/requests/${id}`;
  let to = `${page}?saved=1`;
  try {
    await run(id, by);
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(page);
  revalidatePath(BASE);
  redirect(to);
}

export async function dispatchAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    const supervisorId = idOf(fd, 'supervisorId');
    if (!supervisorId) throw new RequestError('supervisor', 'Masulni tanlang');
    await dispatchToSupervisor(id, supervisorId, by, optText(fd, 'note', 300) ?? undefined);
  });
}

export async function assignAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    const driverId = idOf(fd, 'driverId');
    if (!driverId) throw new RequestError('driver', 'Haydovchini tanlang');
    await assignDriver(id, driverId, by);
  });
}

export async function cancelAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    await cancelRequest(id, by, optText(fd, 'reason', 300) ?? undefined);
  });
}

export async function weighAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    await recordWeighing({
      requestId: id,
      actualWeight: num(fd, 'actualWeight') ?? 0,
      discountPercent: num(fd, 'discountPercent') ?? 0,
      discountReason: optText(fd, 'discountReason', 200),
      materialType: materialOf(fd),
      notes: optText(fd, 'notes', 500),
      actor: by,
    });
  });
}

export async function acceptBaseAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    const r = await prisma.recycleRequest.findUnique({ where: { id }, select: { supervisorId: true, pointId: true, _count: { select: { collections: true } } } });
    if (!r) throw new RequestError('not_found', 'Ariza topilmadi');
    // Haydovchi tortgan ariza bazada qayta qabul qilinmaydi — aks holda yuk jurnalda ham, hisobda ham ikki marta hisoblanadi
    if (r._count.collections > 0) throw new RequestError('status', "Ariza allaqachon tortilgan — to'lovni belgilang");
    // Qabul jurnali masul nomidan yoziladi: ariza masuli, bo'lmasa punktning faol masuli
    const supervisorId = r.supervisorId ?? (await prisma.supervisor.findFirst({ where: { pointId: r.pointId, isActive: true }, orderBy: { id: 'asc' }, select: { id: true } }))?.id;
    if (!supervisorId) throw new RequestError('supervisor', 'Punktga masul biriktiring (jurnalga qabul yozuvi masul nomidan yoziladi)');
    await acceptAtBase({ requestId: id, weightKg: num(fd, 'weightKg') ?? 0, pricePerKg: num(fd, 'pricePerKg'), note: optText(fd, 'note', 200), actor: by, supervisorId });
  });
}

export async function paymentAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    const collectionId = idOf(fd, 'collectionId');
    if (!collectionId) throw new RequestError('not_found', 'Hisob topilmadi');
    const c = await prisma.recycleCollection.findUnique({ where: { id: collectionId }, select: { requestId: true } });
    if (!c || c.requestId !== id) throw new RequestError('not_found', 'Hisob topilmadi');
    await recordPayment({ collectionId, paymentToCustomer: num(fd, 'paymentToCustomer'), paymentToDriver: num(fd, 'paymentToDriver'), note: optText(fd, 'note', 300), actor: by });
  });
}

export async function fixCollectionAction(fd: FormData) {
  await requestAction(fd, async (id, by) => {
    const collectionId = idOf(fd, 'collectionId');
    const c = collectionId ? await prisma.recycleCollection.findUnique({ where: { id: collectionId }, select: { requestId: true, paymentStatus: true } }) : null;
    if (!c || c.requestId !== id) throw new RequestError('not_found', 'Hisob topilmadi');
    // To'lov belgilangan hisob o'zgartirilmaydi — to'langan summa bilan hisob ajralib ketadi, haydovchi balansi buziladi
    if (c.paymentStatus !== 'pending') throw new RequestError('status', "To'lov allaqachon belgilangan — hisobni o'zgartirib bo'lmaydi");
    const actualWeight = num(fd, 'actualWeight');
    if (actualWeight == null || !(actualWeight > 0)) throw new RequestError('status', "Og'irlik 0 dan katta bo'lsin");
    await adminFixCollection(collectionId, { actualWeight, discountPercent: num(fd, 'discountPercent') ?? 0, discountReason: optText(fd, 'discountReason', 200), notes: optText(fd, 'notes', 500) }, by);
  });
}

// ─── Punktlar ────────────────────────────────────────────────────────────────

type PointData = {
  regionUz: string; regionRu: string; cityUz: string; cityRu: string; phone: string; address: string | null;
  lat: number | null; lng: number | null; pricePerKg: number; driverRatePerKg: number; status: RecyclePointStatus; color: string; workingHours: string; isAccepting: boolean;
};

function pointData(fd: FormData): PointData {
  const cityUz = text(fd, 'cityUz', 100);
  const regionUz = text(fd, 'regionUz', 100);
  if (cityUz.length < 2 || regionUz.length < 2) throw new StaffError('name', "Shahar/tuman va viloyat nomini kiriting");
  // Telefon — xodimlardagi kabi qat'iy: faqat 998XXXXXXXXX (mijoz saytida ko'rinadi)
  const phone = normalizePhone(text(fd, 'phone', 30));
  if (!phone) throw new StaffError('phone', "Telefon noto'g'ri. Namuna: +998 90 123 45 67");
  const lat = num(fd, 'lat');
  const lng = num(fd, 'lng');
  if ((lat != null || lng != null) && !(isValidLat(lat) && isValidLng(lng))) throw new StaffError('point', "Koordinata noto'g'ri (lat −90…90, lng −180…180)");
  const pricePerKg = num(fd, 'pricePerKg');
  const driverRatePerKg = num(fd, 'driverRatePerKg');
  if (pricePerKg == null || pricePerKg < 0 || driverRatePerKg == null || driverRatePerKg < 0) throw new StaffError('point', "Narx va haydovchi stavkasi 0 dan kichik bo'lmasin");
  const color = text(fd, 'color', 40);
  return {
    cityUz, regionUz,
    cityRu: text(fd, 'cityRu', 100) || cityUz,
    regionRu: text(fd, 'regionRu', 100) || regionUz,
    phone, address: optText(fd, 'address', 300),
    lat: lat ?? null, lng: lng ?? null,
    pricePerKg, driverRatePerKg,
    status: fd.get('status') === 'planned' ? 'planned' : 'active',
    color: isPointColor(color) ? color : 'bg-emerald-500',
    workingHours: text(fd, 'workingHours', 60) || '08:00-18:00',
    isAccepting: bool(fd, 'isAccepting'),
  };
}

export async function createPointAction(fd: FormData) {
  await actor();
  let to: string;
  try {
    const p = await prisma.recyclePoint.create({ data: pointData(fd) });
    to = `${BASE}/points/${p.id}?saved=1`;
  } catch (e) {
    to = withError(`${BASE}/points/new`, e);
  }
  revalidatePath(`${BASE}/points`);
  redirect(to);
}

export async function updatePointAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/points`);
  const page = `${BASE}/points/${id}`;
  let to = `${page}?saved=1`;
  try {
    await prisma.recyclePoint.update({ where: { id }, data: pointData(fd) });
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(`${BASE}/points`);
  revalidatePath(page);
  redirect(to);
}

/** O'chirish faqat bog'lanishlar bo'lmasa; aks holda "rejada" + qabul to'xtatiladi */
export async function deletePointAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/points`);
  const p = await prisma.recyclePoint.findUnique({ where: { id }, include: { _count: { select: POINT_LINK_COUNTS } } });
  if (!p) redirect(`${BASE}/points`);
  let to: string;
  try {
    if (pointLinkedCount(p._count) === 0) {
      await prisma.recyclePoint.delete({ where: { id } });
      to = `${BASE}/points?deleted=1`;
    } else {
      await prisma.recyclePoint.update({ where: { id }, data: { status: 'planned', isAccepting: false } });
      to = `${BASE}/points/${id}?archived=1`;
    }
  } catch (e) {
    to = withError(`${BASE}/points/${id}`, e);
  }
  revalidatePath(`${BASE}/points`);
  redirect(to);
}

// ─── Masullar ────────────────────────────────────────────────────────────────

export async function createSupervisorForm(_prev: FormState, fd: FormData): Promise<FormState> {
  await actor();
  let id: number;
  try {
    const s = await createSupervisor({ name: text(fd, 'name', 100), phone: text(fd, 'phone', 30), pointId: idOf(fd, 'pointId') || null });
    id = s.id;
  } catch (e) {
    return { error: errMsg(e), values: formValues(fd, ['name', 'phone', 'pointId']) };
  }
  revalidatePath(`${BASE}/supervisors`);
  redirect(`${BASE}/supervisors/${id}?created=1`);
}

export async function updateSupervisorAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/supervisors`);
  const page = `${BASE}/supervisors/${id}`;
  let to = `${page}?saved=1`;
  try {
    const isActive = bool(fd, 'isActive');
    const cur = await prisma.supervisor.findUnique({ where: { id }, select: { isActive: true } });
    if (!cur) throw new StaffError('not_found', 'Masul topilmadi');
    // Faol arizalari bor masul nofaol qilinmaydi — arizalar nofaol masulda osilib qoladi
    if (cur.isActive && !isActive) {
      const n = await prisma.recycleRequest.count({ where: { supervisorId: id, status: { in: ACTIVE_STATUSES } } });
      if (n) throw new StaffError('inactive', `Masulda ${n} ta faol ariza bor — avval ularni boshqa masulga yo'naltiring, keyin nofaol qiling`);
    }
    await updateSupervisor(id, { name: text(fd, 'name', 100), phone: text(fd, 'phone', 30), pointId: idOf(fd, 'pointId') || null, isActive });
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(`${BASE}/supervisors`);
  revalidatePath(page);
  redirect(to);
}

export async function resetSupervisorTelegramAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/supervisors`);
  const page = `${BASE}/supervisors/${id}`;
  let to = `${page}?reset=1`;
  try {
    await resetSupervisorTelegram(id);
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(page);
  redirect(to);
}

// ─── Haydovchilar ────────────────────────────────────────────────────────────

export async function createDriverForm(_prev: FormState, fd: FormData): Promise<FormState> {
  await actor();
  let id: number;
  try {
    const d = await createDriver({ name: text(fd, 'name', 100), phone: text(fd, 'phone', 30), pointId: idOf(fd, 'pointId') || null, supervisorId: idOf(fd, 'supervisorId') || null, vehicleInfo: optText(fd, 'vehicleInfo', 120) });
    id = d.id;
  } catch (e) {
    return { error: errMsg(e), values: formValues(fd, ['name', 'phone', 'pointId', 'supervisorId', 'vehicleInfo']) };
  }
  revalidatePath(`${BASE}/drivers`);
  redirect(`${BASE}/drivers/${id}?created=1`);
}

export async function updateDriverAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/drivers`);
  const page = `${BASE}/drivers/${id}`;
  let to = `${page}?saved=1`;
  try {
    await updateDriver(id, { name: text(fd, 'name', 100), phone: text(fd, 'phone', 30), pointId: idOf(fd, 'pointId') || null, supervisorId: idOf(fd, 'supervisorId') || null, vehicleInfo: optText(fd, 'vehicleInfo', 120) });
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(`${BASE}/drivers`);
  revalidatePath(page);
  redirect(to);
}

/**
 * Bloklash (inactive) yoki qayta faollashtirish.
 * Bloklashda faol topshiriqlar bo'shatiladi: assigned/en_route → masulga qaytadi (dispatched) yoki navbatga (new_);
 * mijoz oldidagi (arrived/collecting) topshiriq bo'lsa — rad etiladi (avval tortish yoki bekor qilish kerak).
 * Faollashtirishda topshirig'i bo'lsa `busy`, bo'lmasa `active`.
 */
export async function setDriverStatusAction(fd: FormData) {
  const by = await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/drivers`);
  const page = `${BASE}/drivers/${id}`;
  const block = fd.get('status') === 'inactive';
  let to = `${page}?saved=1`;
  try {
    const tasks = await driverTasks(id);
    let handed = 0;
    if (block) {
      const atCustomer = tasks.filter((t) => !['assigned', 'en_route'].includes(t.status));
      if (atCustomer.length) throw new RequestError('driver', `Haydovchi mijoz oldida: ${atCustomer.map((t) => `#${t.id}`).join(', ')} — avval tortishni kiriting yoki arizani bekor qiling`);
      for (const t of tasks) {
        // Jadvalda en_route → dispatched/new_ yo'q: avval assigned ga qaytariladi (ruxsat etilgan), keyin qayta taqsimlanadi
        if (t.status === 'en_route') await transition(prisma, t.id, 'assigned', { driverEnRouteAt: null });
        const sup = t.supervisorId ? await prisma.supervisor.findUnique({ where: { id: t.supervisorId }, select: { isActive: true } }) : null;
        if (sup?.isActive) {
          await dispatchToSupervisor(t.id, t.supervisorId!, by, 'Haydovchi bloklandi — boshqa haydovchi tayinlang');
        } else {
          // Masul yo'q/nofaol: navbatga (new_) qaytadi, HQ xabar oladi
          const u = await transition(prisma, t.id, 'new_', { assignedDriverId: null, assignedAt: null, driverEnRouteAt: null });
          await logEvent({ sourceBot: 'platform', eventType: 'driver_unassigned', severity: 'warning', title: `Ariza #${t.id}: haydovchi bloklandi, ariza navbatga qaytdi`, message: `${by.name}`, requestId: t.id, driverId: id, pointId: u.pointId, notifyHq: true });
        }
        handed += 1;
      }
    }
    const status = block ? 'inactive' : tasks.length ? 'busy' : 'active';
    const d = await updateDriver(id, { status });
    if (block) await prisma.driver.update({ where: { id }, data: { isOnline: false } });
    await logEvent({ sourceBot: 'platform', eventType: block ? 'driver_blocked' : 'driver_unblocked', severity: block ? 'warning' : 'info', title: `Haydovchi ${block ? 'bloklandi' : 'faollashtirildi'}: ${d.name}`, message: `${by.name}${handed ? ` · ${handed} ta topshiriq qayta taqsimlandi` : ''}`, driverId: id, pointId: d.pointId, supervisorId: d.supervisorId });
    if (handed) to = `${page}?saved=1&handed=${handed}`;
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(`${BASE}/drivers`);
  revalidatePath(BASE);
  revalidatePath(page);
  redirect(to);
}

export async function resetDriverTelegramAction(fd: FormData) {
  await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/drivers`);
  const page = `${BASE}/drivers/${id}`;
  let to = `${page}?reset=1`;
  try {
    await resetDriverTelegram(id);
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(page);
  redirect(to);
}

export async function bonusAction(fd: FormData) {
  const by = await actor();
  const id = idOf(fd);
  if (!id) redirect(`${BASE}/drivers`);
  const page = `${BASE}/drivers/${id}`;
  let to = `${page}?saved=1`;
  try {
    await addBonus(id, num(fd, 'amount') ?? 0, text(fd, 'description', 200) || 'Bonus', by.name);
    await logEvent({ sourceBot: 'platform', eventType: 'driver_bonus', severity: 'success', title: `Bonus: ${Math.round(num(fd, 'amount') ?? 0).toLocaleString('ru-RU')} so'm`, message: `${by.name}: ${text(fd, 'description', 200) || 'Bonus'}`, driverId: id });
  } catch (e) {
    to = withError(page, e);
  }
  revalidatePath(page);
  redirect(to);
}

/** Kabinet paroli: bir marta yaratiladi va faqat shu javobda ko'rsatiladi (URL/cookie'ga tushmaydi) */
export type IssueState = { ok: true; password: string } | { ok: false; error: string } | null;

export async function issueDriverPassword(_prev: IssueState, fd: FormData): Promise<IssueState> {
  const by = await actor();
  const id = idOf(fd);
  if (!id) return { ok: false, error: 'Haydovchi topilmadi' };
  try {
    const password = await issueDriverCredentials(id);
    if (!password) return { ok: false, error: "Parol allaqachon berilgan. Yangi parol faqat haydovchi boti orqali tiklanadi" };
    await logEvent({ sourceBot: 'platform', eventType: 'driver_password_issued', title: `Haydovchi #${id}: kabinet paroli berildi`, message: by.name, driverId: id });
    // revalidatePath chaqirilmaydi: server daraxti yangilansa client komponent almashib, parol ko'rinmay qoladi
    return { ok: true, password };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
