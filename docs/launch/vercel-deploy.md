# Vercel + Neon deploy

Production stack: **Vercel** (Next.js) + **Neon** (PostgreSQL).

## 1. Vercel project yaratish

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository
2. Repo: `habibullayevmurod73-beep/pack24ai`
3. Framework: Next.js (auto-detect)
4. Root Directory: `./`
5. Build Command: avtomatik `vercel-build` script ishlatiladi (package.json)

## 2. Environment Variables (Production)

| Variable | Qiymat | Izoh |
|----------|--------|------|
| `DATABASE_URL` | Neon pooler URL | `?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Neon direct URL | migrate uchun |
| `AUTH_SECRET` | 32+ random | `generate-secrets.ps1` |
| `NEXTAUTH_SECRET` | = AUTH_SECRET | NextAuth v4 |
| `NEXTAUTH_URL` | `https://pack24.uz` | Production URL |
| `NEXT_PUBLIC_APP_URL` | `https://pack24.uz` | Public linklar |
| `ADMIN_USERNAME` | admin login | |
| `ADMIN_PASSWORD` | kuchli parol | |
| `ADMIN_SECRET` | HMAC kalit | |
| `DRIVER_TOKEN_SECRET` | driver JWT | ADMIN dan farqli |
| `TELEGRAM_WEBHOOK_SECRET` | random | webhook verify |
| `TELEGRAM_OPS_SECRET` | random | `/api/telegram/setup` auth |
| `CUSTOMER_BOT_TOKEN` | BotFather | |
| `DRIVER_BOT_TOKEN` | BotFather | |
| `ADMIN_BOT_TOKEN` | BotFather | |
| `PACK24ADMIN_BOT_TOKEN` | BotFather | |
| `CLICK_*` / `PAYME_*` | merchant | to'lov |
| `NEXT_PUBLIC_SUPABASE_URL` | ixtiyoriy | rasm storage |
| `SUPABASE_SERVICE_ROLE_KEY` | ixtiyoriy | |

Preview environment uchun `NEXTAUTH_URL` va `NEXT_PUBLIC_APP_URL` ni Vercel preview URL ga moslang.

## 3. Build va migrate

`package.json` dagi `vercel-build`:

```bash
npx prisma generate && npx prisma migrate deploy && npm run build
```

Bu har deploy'da schema yangilanishini Neon'ga qo'llaydi.

## 4. Birinchi deploy

Deploy tugagach:
1. Vercel URL ochiladi (masalan `pack24-web.vercel.app`)
2. Smoke test: `PLAYWRIGHT_BASE_URL=https://pack24-web.vercel.app PLAYWRIGHT_NO_SERVER=1 npm run test:e2e:smoke`
3. Domain ulang: [domain-dns.md](./domain-dns.md)
4. Telegram webhook: [telegram-webhooks.md](./telegram-webhooks.md)

## 5. CLI (ixtiyoriy)

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.vercel.local
vercel --prod
```

## Muammolar

| Xato | Yechim |
|------|--------|
| Prisma migrate timeout | `DIRECT_URL` to'g'ri direct Neon URL ekanini tekshiring |
| NextAuth redirect loop | `NEXTAUTH_URL` production domain bilan mos |
| 500 on first load | Vercel logs → Functions → env yo'q bo'lishi mumkin |
