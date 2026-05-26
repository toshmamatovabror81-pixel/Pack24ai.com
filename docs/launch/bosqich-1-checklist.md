# Bosqich 1 — Ishga tushirish checklist

Oxirgi yangilanish: 2026-05-27. Production: **Vercel + Neon + pack24.uz**.

## Bajarilgan (kod repoda)

- [x] Xavfsizlik: husky pre-commit, `.env.example` tozalash, sensitive fayllar olib tashlangan
- [x] TypeScript: `tsc --noEmit` 0 xato
- [x] Design system: Tailwind brand tokens, 92 hex migratsiya (asosiy ranglar)
- [x] Backend: Click/Payme auth, cart transaction, products validation, Pino logger
- [x] Decimal money: Prisma migratsiya + `src/lib/money.ts`
- [x] CI: lint, test, gitleaks, migrate-validate (GitHub Actions)
- [x] Neon DB: 12 migration qo'llangan (`prisma migrate deploy`)
- [x] Payme transaction mapping: `PaymeTransaction` model + webhook

## Production oldidan (bloker)

- [ ] [Token rotatsiya](./security-rotation-checklist.md) — Telegram, Click, Payme, AUTH/ADMIN
- [x] Vercel config: `vercel.json`, `npm run vercel-build`, [vercel-deploy.md](./vercel-deploy.md)
- [x] Smoke e2e: `npm run test:e2e:smoke`
- [x] Telegram WebApp menu button: `src/lib/telegram/webAppMenu.ts`
- [ ] `pack24.uz` DNS → Vercel — [domain-dns.md](./domain-dns.md)
- [ ] Telegram webhook production URL — [telegram-webhooks.md](./telegram-webhooks.md)

## Deploy keyin tekshiruv

```bash
# Lokal
npm test -- --ci
npm run lint
npx tsc --noEmit

# Production smoke (URL kerak)
PLAYWRIGHT_BASE_URL=https://pack24.uz PLAYWRIGHT_NO_SERVER=1 npm run test:e2e:smoke
```

- [ ] Bosh sahifa `/` ochiladi
- [ ] Katalog `/catalog`, savat `/cart`, checkout `/checkout`
- [ ] Admin login `/admin/login`
- [ ] Mobile WebApp `/mobile`
- [ ] Click to'lov URL yaratiladi (test order)
- [ ] Payme webhook test (sandbox)
- [ ] Recycling admin moduli

## Keyingi bosqichlar

| Bosqich | Hujjat | Holat |
|---------|--------|-------|
| 2 — Telegram WebApp | [bosqich-2-webapp.md](./bosqich-2-webapp.md) | Kutilmoqda |
| 3 — Customer Expo | [bosqich-3-customer-expo.md](./bosqich-3-customer-expo.md) | Kutilmoqda |
| 4 — Driver app | [bosqich-4-driver-app.md](./bosqich-4-driver-app.md) | Kutilmoqda |
| 5 — Admin mobil | — | Ixtiyoriy |

## Qolgan sifat ishlari (bloker emas)

- [ ] Catalog component refactor
- [ ] i18n markazlashtirish
- [ ] Admin/mobile `#F9FAFB` → `surface-page` token
