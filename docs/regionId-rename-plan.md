# RecycleRequest.regionId → pointId Rename Plan

## Muammo

`RecycleRequest.regionId` amalda `RecyclePoint.id` ga ishora qiladi.
Bu nom noto'g'ri — `region` emas, balki `point` (yig'ish bazasi) ID si.

## Hozirgi holat

Prisma schema (`prisma/schema.prisma`):
```prisma
model RecycleRequest {
    regionId      Int
    point         RecyclePoint @relation(fields: [regionId], references: [id])
}
```

## Ta'sir ko'lami

**~40+ ta fayl** da `regionId` ishlatiladi:
- `src/app/(main)/admin/recycling/_components/` — DashboardTab, RequestsTab
- `src/app/(main)/admin/recycling/_lib/types.ts` — `getPointName()` funksiyasi
- `src/app/(main)/eco-dashboard/page.tsx`
- `src/app/(main)/recycling/page.tsx`
- `src/app/api/admin/export/route.ts`
- `src/app/api/admin/recycling/` — collections, dispatch testlari
- `src/app/api/recycling/route.ts`
- `src/lib/domain/recycling/` — complaintService, dispatchService, requestService
- `src/lib/telegram/` — adminBot.callback, adminBot.text
- `src/lib/telegram/handlers/customer/` — truckRequest
- `src/lib/telegram/handlers/driver/` — callbacks

## Rename qadamlari

### 1. Typed alias (hozir — P2.5 prep)
```typescript
// src/lib/domain/recycleRequestTypes.ts
/** @deprecated Use pointId — regionId is a misnomer */
export type RecycleRequestPointId = number;
```

### 2. Prisma migration (keyingi sprint)
```sql
ALTER TABLE "RecycleRequest" RENAME COLUMN "regionId" TO "pointId";
```
```prisma
model RecycleRequest {
    pointId       Int
    point         RecyclePoint @relation(fields: [pointId], references: [id])
}
```

### 3. Code rename (Prisma migration bilan birga)
- Barcha 40+ ta fayldagi `regionId` → `pointId` ga o'zgartirish
- API response'larda backward-compatibility uchun vaqtinchalik `regionId` alias qo'shish

> [!WARNING]
> Bu o'zgarish **breaking change** — API consumer'lar `regionId` dan foydalanishi mumkin.
> Avval API versioning yoki deprecation period talab qilinadi.
