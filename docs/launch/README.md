# Pack24 Launch — hujjatlar indeksi

Bosqichma-bosqich production ishga tushirish rejasi.

## Bosqich 1 — Web (Vercel + Neon)

| Hujjat | Maqsad |
|--------|--------|
| [bosqich-1-checklist.md](./bosqich-1-checklist.md) | Joriy holat, bajarilgan/qolgan |
| [bosqich-1-task.md](./bosqich-1-task.md) | Antigravity vazifalar ro'yxati |
| [bosqich-1-walkthrough.md](./bosqich-1-walkthrough.md) | Texnik walkthrough |
| [security-rotation-checklist.md](./security-rotation-checklist.md) | Token rotatsiya |
| [vercel-deploy.md](./vercel-deploy.md) | Vercel + env + build |
| [domain-dns.md](./domain-dns.md) | pack24.uz DNS |
| [telegram-webhooks.md](./telegram-webhooks.md) | Bot webhook |

## Bosqich 2–4 — Mobil

| Hujjat | Maqsad |
|--------|--------|
| [bosqich-2-webapp.md](./bosqich-2-webapp.md) | Telegram WebApp `/mobile` |
| [bosqich-3-customer-expo.md](./bosqich-3-customer-expo.md) | Customer Expo app |
| [bosqich-4-driver-app.md](./bosqich-4-driver-app.md) | Driver web + Expo |
| [mobile-env.example](./mobile-env.example) | Mobil ilova API URL |

## Skriptlar

```powershell
.\scripts\generate-secrets.ps1          # Yangi AUTH/WEBHOOK secretlar
.\scripts\setup-telegram-webhooks.ps1   # Production webhook o'rnatish
npm run test:e2e:smoke                  # Smoke testlar
npm run vercel-build                    # Vercel build + migrate
```
