# Telegram webhook — production

## Webhook URL'lar

| Bot | Path |
|-----|------|
| Customer (@Pack24AI_bot) | `https://pack24.uz/api/telegram/webhook` |
| Driver (@pack24MX_bot) | `https://pack24.uz/api/telegram/webhook/driver` |
| Admin (@pack24AUP_bot) | `https://pack24.uz/api/telegram/webhook/admin` |
| Pack24 Admin (@pack24admin_bot) | `https://pack24.uz/api/telegram/webhook/pack24admin` |

## Talab qilinadigan env

```
TELEGRAM_WEBHOOK_SECRET=<random-32-chars>
TELEGRAM_OPS_SECRET=<random-32-chars>
CUSTOMER_BOT_TOKEN=...
DRIVER_BOT_TOKEN=...
ADMIN_BOT_TOKEN=...
PACK24ADMIN_BOT_TOKEN=...
NEXT_PUBLIC_APP_URL=https://pack24.uz
```

## Avtomatik sozlash (tavsiya)

PowerShell (production URL bilan):

```powershell
$env:TELEGRAM_OPS_SECRET = "your-ops-secret"
$env:NEXT_PUBLIC_APP_URL = "https://pack24.uz"
.\scripts\setup-telegram-webhooks.ps1
```

Yoki API orqali:

```bash
curl -X POST https://pack24.uz/api/telegram/setup \
  -H "Content-Type: application/json" \
  -H "x-telegram-ops-secret: YOUR_TELEGRAM_OPS_SECRET" \
  -d '{"mode":"webhook","baseUrl":"https://pack24.uz"}'
```

Muvaffaqiyatli javob: `"ok": true`, har bot uchun `"✅ Webhook o'rnatildi"`.

## WebApp menu button

Customer bot webhook o'rnatilganda avtomatik:
- Menu button: **Do'kon** / **Магазин**
- URL: `https://pack24.uz/mobile`

Kod: `src/lib/telegram/webAppMenu.ts`

## Tekshiruv

1. Customer botga `/start` yuboring — javob kelishi kerak
2. Menu tugmasi → WebApp ochiladi
3. Driver bot — haydovchi login flow
4. Health: `GET /api/telegram/health` (auth kerak bo'lishi mumkin)

## Dev rejim

Lokalda polling ishlatiladi (`TELEGRAM_DEV_AUTO_POLL=true`). Production'da **faqat webhook** — polling ishlatmang.

## Muammolar

| Belgi | Yechim |
|-------|--------|
| 401 on setup | `TELEGRAM_OPS_SECRET` header tekshiring |
| Bot javob bermaydi | Vercel function logs, token rotatsiya |
| Webhook 403 | `TELEGRAM_WEBHOOK_SECRET` middleware bilan mos |
