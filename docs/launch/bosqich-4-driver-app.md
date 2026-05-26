# Bosqich 4 — Haydovchi ilovasi

Ikki qatlam: web driver UI (repo ichida) + native Expo.

## 1. Web Driver UI (pack24-web)

Sahifalar: `src/app/(driver)/`
- `/driver/login` — kirish
- `/driver/dashboard` — panel
- `/driver/tasks` — vazifalar

API:
- `POST /api/auth/driver/login`
- `GET /api/driver/tasks`
- `POST /api/driver/location`
- `GET /api/driver/stats`

Production URL: `https://pack24.uz/driver/login`

## 2. Native Expo Driver

Repo: `C:\pack24-mobile\apps\driver` yoki `C:\pack24-driver`

```powershell
cd C:\pack24-mobile\apps\driver
# .env
EXPO_PUBLIC_API_URL=https://pack24.uz
npm run start:web -- --port 8082
```

## Tayyor bo'lish sharti

- Recycling moduli production'da ishlayapti
- Driver bot webhook: `/api/telegram/webhook/driver`
- `DRIVER_TOKEN_SECRET` Vercel'da sozlangan

## Driver Telegram bot

Haydovchilar bot orqali ham vazifa oladi:
- Webhook: [telegram-webhooks.md](./telegram-webhooks.md)
- Handler: `src/lib/telegram/handlers/driver/`

## Tekshiruv checklist

- [ ] Driver login (telefon + parol)
- [ ] Tasks ro'yxati yuklanadi
- [ ] Location update yuboriladi
- [ ] Task status yangilash (pickup/delivery)
- [ ] To'lov notification (recycling payment)
- [ ] Expo build internal test

## EAS build

Customer app bilan bir xil EAS workflow — `EXPO_PUBLIC_API_URL=https://pack24.uz`.

## Keyingi (Bosqich 5)

Admin panel mobil responsive + admin bot production webhook.
