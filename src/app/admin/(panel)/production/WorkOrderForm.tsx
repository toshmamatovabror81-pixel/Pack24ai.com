import type { WorkOrder } from '@prisma/client';
import { Field } from '@/components/admin/ui';
import { priorityNames, workOrderStatusNames } from '@/components/admin/production/names';
import { createWorkOrder, updateWorkOrder } from './actions';

/** Buyurtma yoki arizadan oldindan to'ldiriladigan maydonlar */
export type WorkOrderPrefill = Partial<Pick<WorkOrder, 'clientName' | 'customerPhone' | 'productName' | 'quantity' | 'size' | 'notes' | 'orderId' | 'leadId'>>;

const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : '');
const MANUAL_STATUSES = ['planned', 'in_progress', 'paused', 'cancelled'] as const;

export function WorkOrderForm({ wo, prefill }: { wo?: WorkOrder; prefill?: WorkOrderPrefill }) {
  const v = wo ?? prefill ?? {};
  return (
    <form action={wo ? updateWorkOrder : createWorkOrder} className="card grid gap-4 p-5 sm:grid-cols-2">
      {wo && <input type="hidden" name="id" value={wo.id} />}
      {!wo && prefill?.orderId && <input type="hidden" name="orderId" value={prefill.orderId} />}
      {!wo && prefill?.leadId && <input type="hidden" name="leadId" value={prefill.leadId} />}
      <Field label="Mijoz *"><input name="clientName" required defaultValue={v.clientName ?? ''} className="input" /></Field>
      <Field label="Telefon"><input name="customerPhone" type="tel" defaultValue={v.customerPhone ?? ''} className="input" /></Field>
      <Field label="Mahsulot *"><input name="productName" required defaultValue={v.productName ?? ''} className="input" /></Field>
      <Field label="Soni, dona *"><input name="quantity" type="number" min={1} required defaultValue={v.quantity ?? ''} className="input" /></Field>
      <Field label="Muddat *"><input name="deadline" type="date" required defaultValue={d(wo?.deadline)} className="input" /></Field>
      <Field label="Muhimlik">
        <select name="priority" defaultValue={wo?.priority ?? 'normal'} className="input">
          {Object.entries(priorityNames).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Field>
      {wo && (
        <Field label="Holat" hint="«Yakunlangan» barcha bosqichlar tugaganda avtomatik qo'yiladi">
          <select name="status" defaultValue={wo.status} className="input">
            {MANUAL_STATUSES.map((k) => <option key={k} value={k}>{workOrderStatusNames[k]}</option>)}
            {wo.status === 'completed' && <option value="completed">{workOrderStatusNames.completed}</option>}
          </select>
        </Field>
      )}
      <Field label="O'lcham" hint="Masalan, 400×300×250 mm"><input name="size" defaultValue={v.size ?? ''} className="input" /></Field>
      <Field label="Pechat turi" hint="Masalan, fleksopechat 1+0"><input name="printType" defaultValue={wo?.printType ?? ''} className="input" /></Field>
      <Field label="List uzunligi, sm"><input name="sheetLength" inputMode="decimal" defaultValue={wo?.sheetLength ?? ''} className="input" /></Field>
      <Field label="List kengligi, sm" hint="Maydon (m²) avtomatik hisoblanadi"><input name="sheetWidth" inputMode="decimal" defaultValue={wo?.sheetWidth ?? ''} className="input" /></Field>
      <Field label="Qatlamlar soni"><input name="layerCount" type="number" min={1} max={9} defaultValue={wo?.layerCount ?? ''} className="input" /></Field>
      <fieldset className="sm:col-span-2">
        <legend className="label">Qatlamlar (material)</legend>
        <div className="grid gap-2 sm:grid-cols-5">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <input key={n} name={`layer${n}`} placeholder={`${n}-qatlam`} defaultValue={wo?.[`layer${n}`] ?? ''} className="input" />
          ))}
        </div>
      </fieldset>
      <Field label="Izoh" wide><textarea name="notes" rows={3} defaultValue={v.notes ?? ''} className="input" /></Field>
      <div className="sm:col-span-2"><button className="btn-primary">{wo ? 'Saqlash' : 'Yaratish'}</button></div>
    </form>
  );
}
