'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type TaskPriority, type WorkOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { date, num, optText, text } from '@/lib/formData';
import { normalizePhone } from '@/lib/format';
import { STAGE_ORDER } from '@/components/admin/production/names';

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
/** Qo'lda qo'yiladigan holatlar; 'completed' bosqichlar yakunlanganda avtomatik */
const MANUAL_STATUSES: WorkOrderStatus[] = ['planned', 'in_progress', 'paused', 'cancelled'];

/** Musbat INT4 id, aks holda null */
function intId(v: FormDataEntryValue | null) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

/** WO-2026-003 ko'rinishidagi navbatdagi raqam (yil bo'yicha); satr emas, son bo'yicha eng kattasi */
async function nextOrderNo(now = new Date()) {
  const prefix = `WO-${now.getFullYear()}-`;
  const rows = await prisma.workOrder.findMany({ where: { orderNo: { startsWith: prefix } }, select: { orderNo: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.orderNo.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

const isUniqueError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** Formadagi umumiy maydonlar; majburiylari to'ldirilmagan bo'lsa null */
function fieldsFrom(fd: FormData) {
  const clientName = text(fd, 'clientName', 200);
  const productName = text(fd, 'productName', 300);
  const quantity = Math.floor(num(fd, 'quantity') ?? 0);
  const deadline = date(fd, 'deadline');
  if (!clientName || !productName || quantity < 1 || !deadline) return null;
  const sheetLength = num(fd, 'sheetLength');
  const sheetWidth = num(fd, 'sheetWidth');
  // sm² -> m²; umumiy maydon = 1 dona × soni
  const areaPerPiece = sheetLength && sheetWidth && sheetLength > 0 && sheetWidth > 0 ? Math.round((sheetLength * sheetWidth) / 10000 * 10000) / 10000 : null;
  const totalArea = areaPerPiece != null ? Math.round(areaPerPiece * quantity * 100) / 100 : null;
  const layerCount = num(fd, 'layerCount');
  const rawPhone = optText(fd, 'customerPhone', 40);
  return {
    clientName,
    customerPhone: rawPhone ? normalizePhone(rawPhone) ?? rawPhone : null,
    productName,
    quantity,
    deadline,
    priority: PRIORITIES.find((p) => p === fd.get('priority')) ?? 'normal',
    size: optText(fd, 'size', 120),
    printType: optText(fd, 'printType', 120),
    layerCount: layerCount != null && layerCount > 0 ? Math.floor(layerCount) : null,
    layer1: optText(fd, 'layer1', 120),
    layer2: optText(fd, 'layer2', 120),
    layer3: optText(fd, 'layer3', 120),
    layer4: optText(fd, 'layer4', 120),
    layer5: optText(fd, 'layer5', 120),
    sheetLength: sheetLength && sheetLength > 0 ? sheetLength : null,
    sheetWidth: sheetWidth && sheetWidth > 0 ? sheetWidth : null,
    areaPerPiece,
    totalArea,
    notes: optText(fd, 'notes', 3000),
  };
}

export async function createWorkOrder(fd: FormData) {
  await requireStaff('production');
  const orderId = intId(fd.get('orderId'));
  const leadId = intId(fd.get('leadId'));
  const fields = fieldsFrom(fd);
  if (!fields) {
    const p = new URLSearchParams({ error: '1' });
    if (orderId) p.set('order', String(orderId));
    if (leadId) p.set('lead', String(leadId));
    redirect(`/admin/production/new?${p}`);
  }
  // Bog'lanish faqat mavjud yozuvlarga
  const [order, lead] = await Promise.all([
    orderId ? prisma.order.findUnique({ where: { id: orderId }, select: { id: true } }) : null,
    leadId ? prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } }) : null,
  ]);
  const create = async () =>
    prisma.workOrder.create({
      data: {
        ...fields,
        orderNo: await nextOrderNo(),
        status: 'planned',
        progress: 0,
        currentStage: 'gofra',
        orderId: order?.id ?? null,
        leadId: lead?.id ?? null,
        stages: { create: STAGE_ORDER.map((stage) => ({ stage })) },
      },
    });
  // Bir vaqtda ikki xodim yaratsa raqam takrorlanishi mumkin — bir marta qayta urinamiz
  const wo = await create().catch((e) => (isUniqueError(e) ? create() : Promise.reject(e)));
  revalidatePath('/admin/production');
  redirect(`/admin/production/${wo.id}?saved=1`);
}

export async function updateWorkOrder(fd: FormData) {
  await requireStaff('production');
  const id = intId(fd.get('id'));
  const wo = id ? await prisma.workOrder.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!wo) redirect('/admin/production');
  const fields = fieldsFrom(fd);
  if (!fields) redirect(`/admin/production/${wo.id}?error=1`);
  const status = MANUAL_STATUSES.find((s) => s === fd.get('status'));
  await prisma.workOrder.update({ where: { id: wo.id }, data: { ...fields, ...(status ? { status } : {}) } });
  revalidatePath('/admin/production');
  revalidatePath(`/admin/production/${wo.id}`);
  redirect(`/admin/production/${wo.id}?saved=1`);
}

/** Bosqich bo'yicha progress, joriy bosqich va umumiy holatni qayta hisoblash */
async function recomputeWorkOrder(workOrderId: number) {
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId }, include: { stages: true } });
  if (!wo) return;
  const done = new Set(wo.stages.filter((s) => s.status === 'completed').map((s) => s.stage));
  const completed = STAGE_ORDER.filter((s) => done.has(s)).length;
  const allDone = completed === STAGE_ORDER.length;
  const anyStarted = wo.stages.some((s) => s.status !== 'pending');
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      progress: Math.round((completed / STAGE_ORDER.length) * 100),
      currentStage: STAGE_ORDER.find((s) => !done.has(s)) ?? 'qc',
      ...(allDone ? { status: 'completed' } : wo.status === 'planned' && anyStarted ? { status: 'in_progress' } : {}),
    },
  });
}

async function applyStage(fd: FormData, mode: 'save' | 'start' | 'finish') {
  await requireStaff('production');
  const stageId = intId(fd.get('stageId'));
  const stage = stageId ? await prisma.workOrderStage.findUnique({ where: { id: stageId } }) : null;
  if (!stage) redirect('/admin/production');
  const now = new Date();
  const data: Parameters<typeof prisma.workOrderStage.update>[0]['data'] = { operator: optText(fd, 'operator', 120), notes: optText(fd, 'notes', 2000) };
  if (mode === 'start' && stage.status === 'pending') {
    data.status = 'in_progress';
    data.startedAt = now;
  }
  if (mode === 'finish' && stage.status !== 'completed') {
    data.status = 'completed';
    data.completedAt = now;
    if (!stage.startedAt) data.startedAt = now;
  }
  await prisma.workOrderStage.update({ where: { id: stage.id }, data });
  if (mode !== 'save') await recomputeWorkOrder(stage.workOrderId);
  revalidatePath('/admin/production');
  revalidatePath(`/admin/production/${stage.workOrderId}`);
  redirect(`/admin/production/${stage.workOrderId}?saved=1`);
}

/** Operator va izohni saqlash (holat o'zgarmaydi) */
export async function saveStage(fd: FormData) {
  await applyStage(fd, 'save');
}

/** "Boshlash": bosqich jarayonda, ish buyurtmasi rejadan jarayonga o'tadi */
export async function startStage(fd: FormData) {
  await applyStage(fd, 'start');
}

/** "Yakunlash": bosqich yakunlanadi, progress va joriy bosqich qayta hisoblanadi */
export async function finishStage(fd: FormData) {
  await applyStage(fd, 'finish');
}

/** Bosqichlari yo'q (boshqa joydan yaratilgan) ish buyurtmasi uchun 4 ta bosqich ochish */
export async function ensureStages(fd: FormData) {
  await requireStaff('production');
  const id = intId(fd.get('id'));
  const wo = id ? await prisma.workOrder.findUnique({ where: { id }, include: { stages: { select: { stage: true } } } }) : null;
  if (!wo) redirect('/admin/production');
  const have = new Set(wo.stages.map((s) => s.stage));
  const missing = STAGE_ORDER.filter((s) => !have.has(s));
  if (missing.length) await prisma.workOrderStage.createMany({ data: missing.map((stage) => ({ workOrderId: wo.id, stage })) });
  revalidatePath(`/admin/production/${wo.id}`);
  redirect(`/admin/production/${wo.id}?saved=1`);
}
