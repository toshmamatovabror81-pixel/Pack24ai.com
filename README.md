# Pack24 — pack24.uz sayti

Qadoqlash mahsulotlari do'koni: 3 tilli sayt (uz/ru/en), katalog, savat va buyurtma (Payme, Click, naqd, hisob-faktura), mijoz kabineti, ulgurji so'rov formalari, blog, admin panel.

Telegram botlar admin panel bilan bitta bazada ishlaydi: mijoz boti (buyurtma holati va ishlab chiqarish bosqichi, balans — qarzdorlik, rekvizitlar, holat o'zgarsa avtomatik xabar) va boshqaruv boti (xodimlar uchun: yangi buyurtma va to'lov xabarlari, holatni botdan o'zgartirish, qidiruv, kunlik eslatma).

Texnologiyalar: Next.js 15 (App Router), React 19, Prisma 6, PostgreSQL 16, Tailwind. Serverda Docker orqali ishlaydi (Caddy avtomatik HTTPS beradi).

## Tuzilma

- `src/app/[lang]` — sayt sahifalari (til prefiksi bilan)
- `src/app/admin` — admin panel (buyurtmalar, mahsulotlar, kategoriyalar, mijozlar, so'rovlar, promo, bannerlar, sharhlar, blog, FAQ, hisobotlar, xodimlar, sozlamalar)
- `src/app/api` — Payme/Click webhook'lar, Telegram bot webhook'lari, davriy ishlar (`/api/cron/tick`), savat hisobi, rasm yuklash, `/api/health`
- `src/lib` — baza, auth, narx hisoblash, buyurtma, to'lovlar, SEO, i18n lug'atlari
- `prisma` — sxema, migratsiyalar, `seed/catalog.sql` (boshlang'ich 120 mahsulot)
- `deploy` — server skriptlari (o'rnatish, yangilash, zaxira), Caddyfile
- `docs/DEPLOY-UZCLOUD.md` — serverga joylash qo'llanmasi

## Lokal ishga tushirish

```bash
cp .env.example .env.local      # DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_USERNAME/PASSWORD
npm ci
npx prisma migrate deploy
npm run db:seed                 # bazada mahsulot bo'lmasa katalogni yuklaydi
npm run dev                     # http://localhost:3000
```

Tekshiruvlar: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

`npm test` bazasiz ishlaydi va `src/lib/__tests__/db` dagi testlarni o'tkazib yuboradi (natijada "skipped"). Mijozlar orasidagi ajratish, qarzdorlik hisobi, holat/to'lov o'zgarishi va xodimni botga ulash aynan shu testlarda haqiqiy PostgreSQL bilan tekshiriladi — `src/lib` yoki botlar o'zgarganda push'dan oldin ularni mahalliy bo'sh bazada ishga tushiring: [docs/DEPLOY-UZCLOUD.md](docs/DEPLOY-UZCLOUD.md), "Ishlab chiquvchilar uchun: testlar" bo'limi.

## Serverga joylash

```bash
curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/Pack24ai.com/main/deploy/server-setup.sh | sudo BRANCH=main bash
```

Batafsil: [docs/DEPLOY-UZCLOUD.md](docs/DEPLOY-UZCLOUD.md).
