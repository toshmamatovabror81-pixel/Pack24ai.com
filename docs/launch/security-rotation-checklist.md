# Token rotatsiya checklist

Production'ga chiqishdan **oldin** barcha punktlarni bajaring. Batafsil: [security-action-required.md](../security-action-required.md).

## Tez boshlash

Yangi sirlar generatsiya qilish (lokal terminalda):

```powershell
# Windows PowerShell
.\scripts\generate-secrets.ps1
```

Natija `.env.rotation-draft` faylida — **commit qilmang**, faqat Vercel env'ga nusxalang.

## Checklist

### Telegram (BotFather → /revoke → yangi token)

- [ ] `CUSTOMER_BOT_TOKEN` (Pack24AI_bot)
- [ ] `DRIVER_BOT_TOKEN` (pack24MX_bot)
- [ ] `ADMIN_BOT_TOKEN` (pack24AUP_bot)
- [ ] `PACK24ADMIN_BOT_TOKEN` (pack24admin_bot)

### To'lov

- [ ] `CLICK_SECRET_KEY`
- [ ] `CLICK_MERCHANT_USER_ID` (agar leak bo'lsa)
- [ ] `PAYME_SECRET_KEY`
- [ ] `PAYME_TEST_SECRET`

### Auth

- [ ] `AUTH_SECRET` / `NEXTAUTH_SECRET` (32+ belgi)
- [ ] `ADMIN_SECRET`
- [ ] `ADMIN_PASSWORD`
- [ ] `DRIVER_TOKEN_SECRET`

### Operatsion

- [ ] `TELEGRAM_OPS_SECRET`
- [ ] `TELEGRAM_WEBHOOK_SECRET`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Storage ishlatilsa)
- [ ] `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- [ ] `GEMINI_API_KEY` (AI ishlatilsa)

### Database (ixtiyoriy)

- [ ] Neon parol rotatsiya (`DATABASE_URL`, `DIRECT_URL`)

## Vercel'ga qo'yish

1. [Vercel Dashboard](https://vercel.com) → Project → Settings → Environment Variables
2. Har bir yangi qiymatni **Production** va **Preview** ga qo'shing
3. Redeploy: Deployments → ... → Redeploy

## Tasdiqlash

```powershell
# Git index'da sir fayl yo'qligini tekshirish
git ls-files | Select-String -Pattern '\.env$|\.db$|BOT_TOKENS'
# Bo'sh bo'lishi kerak
```

Rotatsiyadan keyin:
- [ ] Eski Telegram tokenlar BotFather'da bekor qilingan
- [ ] Vercel production redeploy qilingan
- [ ] Lokal `.env` yangilangan
