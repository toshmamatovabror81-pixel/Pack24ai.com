# Schema audit — 2026-05-21

P2.3 vazifasi bo'yicha Neon PostgreSQL DB'sidagi haqiqiy status qiymatlari
auditi. Maqsad: `User.role`, `customerType`, `customerGroup`, `Campaign.type`
va boshqa qolgan string status maydonlarini Prisma enum'ga xavfsiz tarzda
ko'chirish uchun ma'lumot tayyorlash.

Audit skript: [scripts/audit-statuses.ts](scripts/audit-statuses.ts)
Ishlatish: `npx tsx scripts/audit-statuses.ts`

## Xulosa

**Hech qaysi status maydonida typo yoki yetim qiymat topilmadi.** Hozirgi
runtime kod qatlami (`src/lib/domain/orderStatuses.ts`,
`src/lib/domain/recycling/statuses.ts`) DB'dagi qiymatlar bilan to'liq
mos keladi. Enum migratsiyasi xavfsiz.

## P2.4 ga to'g'ri keladigan natijalar

### `User.role` — String → enum `UserRole`

| Qiymat | Soni | Tipi |
|---|---|---|
| `staff` | 4 | mavjud |
| `user` | 3 | mavjud |
| `manager` | 1 | mavjud |
| `admin` | 0 | yo'q (ehtimol, hech qachon DB'da bo'lmagan; admin auth alohida cookie/HMAC) |

**Tavsiya etilgan enum:**

```prisma
enum UserRole {
  user
  staff
  manager
  admin
}
```

### `User.customerType` — String → enum `CustomerType`

| Qiymat | Soni |
|---|---|
| `individual` | 7 |
| `corporate` | 1 |

`wholesale`, `dealer` typed SoT'da bor, lekin DB'da hali ishlatilmagan.

```prisma
enum CustomerType {
  individual
  corporate
  wholesale
  dealer
}
```

### `User.customerGroup` — String → enum `CustomerGroup`

| Qiymat | Soni |
|---|---|
| `standard` | 8 |

`vip`, `new`, `inactive`, `blocked` typed SoT'da bor, lekin DB'da hali ishlatilmagan.

```prisma
enum CustomerGroup {
  standard
  vip
  new_     @map("new")
  inactive
  blocked
}
```

Diqqat: `new` keyword'i Prisma'da maxsus belgi talab qiladi (`@map`).

### `Campaign.type` — String → enum `CampaignType`

DB hozir bo'sh — birinchi `INSERT`gacha xavf yo'q.

```prisma
enum CampaignType {
  telegram
  sms
  email
}
```

### `User.department` — String? → enum `UserDepartment` (ixtiyoriy)

| Qiymat | Soni |
|---|---|
| `null` | 3 |
| `warehouse` | 1 |
| `production` | 1 |
| `household` | 1 |
| `sales` | 1 |
| `management` | 1 |

3 yozuv `null`. Enum nullable bo'lib qoladi. Migratsiya P2.4 doirasidan tashqarida — keyingi bosqichga qoldirilishi mumkin.

## DB'da hozirda ishlatiladigan qiymatlar (umumiy)

| Maydon | Mavjud qiymatlar |
|---|---|
| `Order.status` | new (7), cancelled (5), draft (2) — enum allaqachon |
| `Order.paymentStatus` | pending (14) — enum allaqachon |
| `Product.status` | active (145) — enum allaqachon |
| `RecycleRequest.status` | dispatched (2), confirmed (1) — enum allaqachon |
| `RecycleRequest.pickupType` | pickup (3) — String, kelajakda enum kandidati |
| `RecycleRequest.pickupLocationMode` | null (3) — String, hozir ishlatilmaydi |
| `Driver.status` | active (5) — enum allaqachon |
| `WorkOrder.status` | planned (1) — enum allaqachon |
| `Task.status` | pending (7) — enum allaqachon |
| `Task.priority` | normal (7) — enum allaqachon |
| `Campaign.type` | bo'sh |
| `Campaign.audience` | bo'sh |
| `RecycleCollection.paymentStatus` | bo'sh |
| `RecycleComplaint.status` | bo'sh |

## Migratsiya tartibi (P2.4)

1. Schema'ga 4 ta yangi enum qo'shish: `UserRole`, `CustomerType`, `CustomerGroup`, `CampaignType`
2. `User.role` → `UserRole @default(user)`
3. `User.customerType` → `CustomerType @default(individual)`
4. `User.customerGroup` → `CustomerGroup @default(standard)`
5. `Campaign.type` → `CampaignType`
6. `npx prisma migrate dev --name string_status_to_enum`
7. Mavjud `*.ts` fayllarda string literal'lar enum import'larga almashtiriladi (yangi tip Prisma client tomonidan generate qilinadi)

## Xavf

- Mavjud kod ko'p joyda `'user'`, `'staff'` kabi string literal'larni
  taqqoslaydi. Postgres enum + Prisma'da bu hali ham ishlaydi (Prisma
  client enum'ni string sifatida JSON'ga aylantiradi). Lekin
  `prisma.user.create({ data: { role: 'unknown' } })` endi compile-time
  xatosi bo'ladi.
- `default("user")` qiymati Postgres tomonidan tekshiriladi — DB ichida
  literal `'user'` enum entry bo'lishi kerak.

## Audit yangilab turish

Bu audit `scripts/audit-statuses.ts` bilan istalgan vaqtda qayta yuritilishi mumkin. CI bosqichida ham bajarish mumkin (nigtly job).
