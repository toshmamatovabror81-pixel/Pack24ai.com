# Pack24 — Bosqich 1 Walkthrough

> Manba: Antigravity walkthrough.md (2026-05). Repoga saqlangan nusxa.

## Barcha Tekshiruvlar

| Tekshiruv | Natija |
|-----------|--------|
| `npx tsc --noEmit` | 0 xato |
| `next build` | Muvaffaqiyatli |
| Brand color audit (asosiy tokenlar) | `tailwind.config.js` + `globals.css` |
| Pre-commit hook | `.husky/pre-commit` (gitleaks + tsc) |
| Jest | 592/592 test |

---

## Faza 1.1: Xavfsizlik

| Fayl | O'zgartirish |
|------|-------------|
| [.env.example](../../.env.example) | Placeholder sirlar, Neon format |
| [.husky/pre-commit](../../.husky/pre-commit) | Gitleaks + TSC pre-commit hook |
| BOT_TOKENS.env, dev.db | O'chirilgan (git tarixida hali bor — [security-action-required.md](../security-action-required.md)) |

---

## Faza 1.5: Backend Stabilizatsiya

| Fayl | Yechim |
|------|--------|
| [click/route.ts](../../src/app/api/payment/click/route.ts) | Session + ownership + amount verification |
| [payme/webhook/route.ts](../../src/app/api/payment/payme/webhook/route.ts) | 5 JSON-RPC method + PaymeTransaction mapping |
| [orders/route.ts](../../src/app/api/orders/route.ts) | Invoice race condition retry + P2002 |
| [cart/route.ts](../../src/app/api/cart/route.ts) | `$transaction` + 50-item limit |
| [products/route.ts](../../src/app/api/products/route.ts) | Enum validation + NaN guard |

---

## Faza 1.4: Design System

### Tailwind — [tailwind.config.js](../../tailwind.config.js)
- 9 brand color tokens + surface tokens
- Inter + Outfit fonts
- Animations: fade-in-up, fade-in, slide-in-right, pulse-soft
- Shadows: card, card-hover, elevated
- `max-w-site: 1400px`

### Komponentlar
- [MobileCategoryStrip](../../src/components/home/MobileCategoryStrip.tsx) — scroll snap + gradient fade
- [Navbar](../../src/components/Navbar.tsx) — brand tokens

---

## Keyingi bosqichlar

1. [vercel-deploy.md](./vercel-deploy.md) — Vercel + Neon production
2. [telegram-webhooks.md](./telegram-webhooks.md) — Bot webhook sozlash
3. [bosqich-2-webapp.md](./bosqich-2-webapp.md) — Telegram WebApp
4. [bosqich-3-customer-expo.md](./bosqich-3-customer-expo.md) — Customer Expo
5. [bosqich-4-driver-app.md](./bosqich-4-driver-app.md) — Driver app
