# Pack24 — Vazifalar Ro'yxati

> Manba: Antigravity task.md (2026-05). Repoga saqlangan nusxa.

## BOSQICH 1: Web Sahifani Ishga Tushirish

### Faza 1.1: Kritik Xavfsizlik — BAJARILDI
- [x] `.env.example` — Supabase ID va admin username tozalandi
- [x] `BOT_TOKENS.env`, `dev.db` fayllar o'chirildi
- [x] Husky + pre-commit hook o'rnatildi (gitleaks + tsc)
- [ ] Token rotatsiyasi — qo'lda: [security-rotation-checklist.md](./security-rotation-checklist.md)

### Faza 1.2: TypeScript — BAJARILDI
- [x] `npx tsc --noEmit` — 0 xato
- [x] `next build` — muvaffaqiyatli

### Faza 1.4: Design System — BAJARILDI
- [x] Tailwind design tokens (9 brand colors, fonts, animations, shadows)
- [x] CSS variables + Google Fonts (Inter, Outfit)
- [x] 92 hardcoded hex → brand token migratsiya (40+ fayl)
- [x] MobileCategoryStrip UX (scroll snap, gradient fade)
- [ ] Catalog component refactor (large but functional)
- [ ] i18n markazlashtirish

### Faza 1.5: Backend Stabilizatsiya — BAJARILDI
- [x] Click payment — auth + ownership + amount verification
- [x] Payme payment — auth + webhook (5 method)
- [x] Cart — `$transaction` + 50-item limit
- [x] Products — status validation + NaN guard + error fix
- [x] Console.log → Pino logger
- [x] Invoice race condition — retry loop + P2002 handling
- [x] Decimal money migratsiya (commit `07b35b0`, Neon migrate deploy)

### Qolgan ishlar (Bosqich 1 production)
- [ ] Token rotatsiya + Vercel env: [vercel-deploy.md](./vercel-deploy.md)
- [ ] Domain DNS: [domain-dns.md](./domain-dns.md)
- [ ] Telegram webhook: [telegram-webhooks.md](./telegram-webhooks.md)
- [ ] Production smoke: `npm run test:e2e:smoke`
- [ ] Payme transaction mapping (PaymeTransaction model)

---

## BOSQICH 2: Telegram WebApp
- [ ] WebApp menu button + `/mobile/*` production test: [bosqich-2-webapp.md](./bosqich-2-webapp.md)

## BOSQICH 3: Customer Expo ilova
- [ ] `pack24-mobile` production API: [bosqich-3-customer-expo.md](./bosqich-3-customer-expo.md)

## BOSQICH 4: Haydovchi ilovasi
- [ ] Driver web + Expo: [bosqich-4-driver-app.md](./bosqich-4-driver-app.md)

## BOSQICH 5: Admin mobil optimizatsiya (ixtiyoriy)
- [ ] Admin panel responsive + admin bot webhook
