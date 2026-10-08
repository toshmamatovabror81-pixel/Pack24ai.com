# Pack24 — pack24.uz sayti

Qadoqlash mahsulotlari do'koni: 3 tilli sayt (uz/ru/en), katalog, savat va buyurtma (Payme, Click, naqd, hisob-faktura), mijoz kabineti, ulgurji so'rov formalari, blog, admin panel.

Texnologiyalar: Next.js 15 (App Router), React 19, Prisma 6, PostgreSQL 16, Tailwind. Serverda Docker orqali ishlaydi (Caddy avtomatik HTTPS beradi).

## Tuzilma

- `src/app/[lang]` — sayt sahifalari (til prefiksi bilan)
- `src/app/admin` — admin panel (buyurtmalar, mahsulotlar, kategoriyalar, mijozlar, so'rovlar, promo, bannerlar, sharhlar, blog, FAQ, hisobotlar, xodimlar, sozlamalar)
- `src/app/api` — Payme/Click webhook'lar, savat hisobi, rasm yuklash, `/api/health`
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

## Serverga joylash

```bash
curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/pack24ai.com/main/deploy/server-setup.sh | sudo bash
```

Batafsil: [docs/DEPLOY-UZCLOUD.md](docs/DEPLOY-UZCLOUD.md).
