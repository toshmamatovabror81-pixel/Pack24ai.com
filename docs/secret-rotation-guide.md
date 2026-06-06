# Sirlarni Rotatsiya Qilish Yo'riqnomasi

> Pack24 loyihasi uchun barcha sirlarni (secrets) xavfsiz almashtirishning to'liq qo'llanmasi.

---

## Mundarija

1. [Tayyorgarlik](#1-tayyorgarlik)
2. [Avtomatik generatsiya](#2-avtomatik-generatsiya-generate-secretsps1)
3. [Telegram bot tokenlari](#3-telegram-bot-tokenlari)
4. [Toʻlov tizimi sirlari](#4-tolov-tizimi-sirlari)
5. [Auth va Admin sirlari](#5-auth-va-admin-sirlari)
6. [Operatsion sirlar](#6-operatsion-sirlar)
7. [Tashqi servislar](#7-tashqi-servislar)
8. [Database credential](#8-database-credential)
9. [VAPID kalitlari](#9-vapid-kalitlari-web-push)
10. [Git tarixini tozalash](#10-git-tarixini-tozalash)
11. [Vercelga joylash](#11-vercelga-joylash)
12. [Yakuniy tekshiruv](#12-yakuniy-tekshiruv-checklist)

---

## 1. Tayyorgarlik

Rotatsiya boshlashdan oldin quyidagi shartlarni bajaring:

- [ ] Git reponing to'liq backup'ini olish:
  ```bash
  git clone --mirror . ../pack24-web-backup-$(date +%Y%m%d).git
  ```
- [ ] Vercel Dashboard'ga kirish imkoniyatini tekshirish
- [ ] BotFather'ga Telegram orqali kirish
- [ ] Payme va Click merchant kabinetlariga kirish
- [ ] Supabase Dashboard'ga kirish
- [ ] Neon Dashboard'ga kirish
- [ ] Jamoaning barcha a'zolarini ogohlantirish

---

## 2. Avtomatik generatsiya (`generate-secrets.ps1`)

Loyihada tayyor skript mavjud — u `AUTH_SECRET`, `ADMIN_SECRET`, `DRIVER_TOKEN_SECRET`, `TELEGRAM_WEBHOOK_SECRET` va `TELEGRAM_OPS_SECRET` ni avtomatik generatsiya qiladi.

```powershell
# Windows PowerShell da ishga tushiring:
.\scripts\generate-secrets.ps1
```

**Natija:** `.env.rotation-draft` faylida yangi qiymatlar paydo bo'ladi.

> ⚠️ **Muhim:** Bu faylni HECH QACHON git'ga commit qilmang! Faqat Vercel environment variables'ga nusxalang.

Skript quyidagi sirlarni generatsiya qiladi:

| O'zgaruvchi | Tur | Uzunlik |
|---|---|---|
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Base64 | 32 bayt |
| `ADMIN_SECRET` | Base64 | 32 bayt |
| `DRIVER_TOKEN_SECRET` | Base64 | 32 bayt |
| `TELEGRAM_WEBHOOK_SECRET` | Hex | 32 bayt |
| `TELEGRAM_OPS_SECRET` | Hex | 32 bayt |

---

## 3. Telegram bot tokenlari

Har bir bot uchun BotFather orqali tokenni bekor qilib, yangisini oling:

- [ ] **`CUSTOMER_BOT_TOKEN`** (Pack24AI_bot)
  1. Telegram'da [@BotFather](https://t.me/BotFather) ga yozing
  2. `/revoke` buyrug'ini yuboring
  3. Pack24AI_bot ni tanlang
  4. Yangi tokenni nusxalang
  5. Vercel va lokal `.env` ga yozing

- [ ] **`DRIVER_BOT_TOKEN`** (pack24MX_bot)
  1. BotFather → `/revoke` → pack24MX_bot → yangi token

- [ ] **`ADMIN_BOT_TOKEN`** (pack24AUP_bot)
  1. BotFather → `/revoke` → pack24AUP_bot → yangi token

- [ ] **`PACK24ADMIN_BOT_TOKEN`** (pack24admin_bot)
  1. BotFather → `/revoke` → pack24admin_bot → yangi token

> 💡 **Maslahat:** Yangi tokenni olgandan keyin eski token darhol ishlamay qoladi. Shu sababli yangi tokenni **avval** Vercel'ga qo'ying, keyin redeploy qiling.

---

## 4. To'lov tizimi sirlari

### Click

- [ ] **`CLICK_SECRET_KEY`**
  1. [Click Merchant kabineti](https://merchant.click.uz)ga kiring
  2. Sozlamalar → API kalitlar → Yangi kalit yaratish
  3. Eski kalitni oʻchirib tashlang
  4. Yangi kalitni Vercel'ga qo'ying

- [ ] **`CLICK_MERCHANT_USER_ID`** (agar leak bo'lgan bo'lsa)
  1. Click merchant kabinetida yangi foydalanuvchi yarating
  2. Eski foydalanuvchini o'chirib tashlang

### Payme

- [ ] **`PAYME_SECRET_KEY`**
  1. [Payme Merchant kabineti](https://merchant.payme.uz)ga kiring
  2. Sozlamalar → Sirli kalit → Yangilash
  3. Yangi kalitni Vercel'ga qo'ying

- [ ] **`PAYME_TEST_SECRET`**
  1. Payme sandbox/test muhitida yangi kalit yarating
  2. Yangi kalitni Vercel Preview muhitiga qo'ying

---

## 5. Auth va Admin sirlari

Bu sirlar `generate-secrets.ps1` orqali avtomatik generatsiya qilinadi (2-bosqichga qarang), lekin qo'lda ham yaratish mumkin:

- [ ] **`AUTH_SECRET`** / **`NEXTAUTH_SECRET`** (bir xil qiymat)
  ```bash
  openssl rand -base64 32
  ```
  Kamida 32 belgi bo'lishi shart.

- [ ] **`ADMIN_SECRET`** (HMAC kalit)
  ```bash
  openssl rand -base64 32
  ```
  `AUTH_SECRET` dan **farqli** bo'lishi kerak.

- [ ] **`ADMIN_PASSWORD`**
  - Kamida 16 belgi
  - Katta-kichik harflar, raqamlar, maxsus belgilar
  - Ilgari ishlatilmagan murakkab parol tanlang

- [ ] **`DRIVER_TOKEN_SECRET`**
  ```bash
  openssl rand -base64 32
  ```
  `ADMIN_SECRET` dan **farqli** bo'lishi kerak.

---

## 6. Operatsion sirlar

Bu sirlar ham `generate-secrets.ps1` orqali generatsiya qilinadi:

- [ ] **`TELEGRAM_WEBHOOK_SECRET`**
  ```bash
  openssl rand -hex 32
  ```
  Webhook so'rovlarini tekshirish uchun ishlatiladi.

- [ ] **`TELEGRAM_OPS_SECRET`**
  ```bash
  openssl rand -hex 32
  ```
  Operatsion API so'rovlarini tekshirish uchun ishlatiladi.

---

## 7. Tashqi servislar

### Supabase

- [ ] **`SUPABASE_SERVICE_ROLE_KEY`**
  1. [Supabase Dashboard](https://supabase.com/dashboard) → Project → Settings → API
  2. "Reset service_role key" tugmasini bosing
  3. Yangi kalitni nusxalab, Vercel'ga qo'ying

### Google Gemini AI

- [ ] **`GEMINI_API_KEY`** (agar ishlatilsa)
  1. [Google AI Studio](https://aistudio.google.com/apikey) ga kiring
  2. Eski kalitni o'chirib tashlang
  3. Yangi kalit yarating
  4. Vercel'ga qo'ying

---

## 8. Database credential

- [ ] **`DATABASE_URL`** va **`DIRECT_URL`**
  1. [Neon Dashboard](https://console.neon.tech) → Project → Connection Details
  2. "Reset password" tugmasini bosing (agar mavjud bo'lsa)
  3. Yangi connection string'larni oling:
     - `DATABASE_URL` = pooler (PgBouncer) ulanishi
     - `DIRECT_URL` = to'g'ridan-to'g'ri ulanish (migrate uchun)
  4. Vercel'dagi ikkala muhit o'zgaruvchisini yangilang

---

## 9. VAPID kalitlari (Web Push)

- [ ] **`VAPID_PUBLIC_KEY`** va **`VAPID_PRIVATE_KEY`**
  ```bash
  npx web-push generate-vapid-keys
  ```
  - `VAPID_PUBLIC_KEY` — Vercel'ga va `NEXT_PUBLIC_VAPID_PUBLIC_KEY` sifatida qo'ying
  - `VAPID_PRIVATE_KEY` — faqat Vercel server muhitida

> ⚠️ **Diqqat:** VAPID kalitlarini almashtirgandan keyin foydalanuvchilarning push notification obunalari bekor bo'ladi. Ular qaytadan obuna bo'lishlari kerak bo'ladi.

---

## 10. Git tarixini tozalash

Agar sirlar git tarixiga commit qilingan bo'lsa, ularni butunlay olib tashlash kerak.

### 10.1. `git-filter-repo` o'rnatish

```bash
# Windows (pip orqali)
pip install git-filter-repo

# yoki scoop orqali
scoop install git-filter-repo
```

### 10.2. Tarixdan sirlarni olib tashlash

```bash
# 1. Avval backup oling!
git clone --mirror . ../pack24-web-backup-$(date +%Y%m%d).git

# 2. Kerakli fayllarni tarixdan o'chirish
git filter-repo --invert-paths \
  --path BOT_TOKENS.env \
  --path dev.db \
  --path prisma/dev.db \
  --force

# 3. Natijani tekshiring
git log --all --full-history -- BOT_TOKENS.env dev.db prisma/dev.db
# Bu buyruq BO'SH natija qaytarishi kerak
```

### 10.3. Remote'ga force-push

```bash
# ⚠️ DIQQAT: Bu qadam tarixni qaytarib bo'lmaydigan tarzda o'zgartiradi!
# Barcha jamoalar a'zolarini OLDINDAN ogohlantiring!

# 1. Remote'ni qayta qo'shing (filter-repo olib tashlaydi)
git remote add origin git@github.com:YOUR_ORG/pack24-web.git

# 2. Force push
git push --force --all
git push --force --tags

# 3. Jamoaning barcha a'zolari reponi qaytadan clone qilsinlar:
git clone git@github.com:YOUR_ORG/pack24-web.git
```

### 10.4. GitHub keshini tozalash

- [ ] GitHub Support'ga murojaat qilib, eski commit'larning keshini tozalashni so'rang
- [ ] Yoki repo'ni private qilib, keyin yana public qiling

---

## 11. Vercel'ga joylash

Barcha yangi sirlarni Vercel'ga qo'yish tartibi:

1. [Vercel Dashboard](https://vercel.com) → Project (pack24-web) → Settings → Environment Variables
2. Har bir yangi qiymatni quyidagi muhitlarga qo'shing:
   - **Production** — asosiy sayt uchun
   - **Preview** — PR preview deploy'lar uchun
3. Eski qiymatlarni o'chirib tashlang
4. Redeploy qilish: Deployments → "..." → "Redeploy"

> 💡 **Maslahat:** `generate-secrets.ps1` tomonidan yaratilgan `.env.rotation-draft` faylidan qiymatlarni nusxalashingiz mumkin.

---

## 12. Yakuniy tekshiruv (Checklist)

Rotatsiyadan keyin barcha nuqtalarni tekshiring:

### Fayllar tekshiruvi

- [ ] Git index'da sir fayllar yo'q:
  ```powershell
  git ls-files | Select-String -Pattern '\.env$|\.db$|BOT_TOKENS'
  # Natija BO'SH bo'lishi kerak
  ```

- [ ] `.env.rotation-draft` fayli gitignore'da:
  ```powershell
  git status --porcelain | Select-String 'rotation-draft'
  # Natija BO'SH bo'lishi kerak (tracking qilinmagan)
  ```

### Servislar tekshiruvi

- [ ] Sayt ishlayapti: https://pack24.uz
- [ ] Admin panel ishlayapti: yangi `ADMIN_PASSWORD` bilan kiring
- [ ] Telegram botlar javob beradi (har bir bot uchun `/start` yuboring):
  - [ ] Pack24AI_bot (Mijoz boti)
  - [ ] pack24MX_bot (Haydovchi boti)
  - [ ] pack24AUP_bot (Admin boti)
  - [ ] pack24admin_bot (Pack24Admin boti)
- [ ] To'lov tizimi ishlayapti (test to'lov qiling):
  - [ ] Click
  - [ ] Payme
- [ ] Rasm yuklash ishlayapti (Supabase Storage)
- [ ] Push notification ishlayapti (VAPID yangilangan bo'lsa)

### Eski tokenlar bekor qilingan

- [ ] Eski Telegram tokenlar BotFather'da `/revoke` qilingan
- [ ] Eski Click API kaliti o'chirilgan
- [ ] Eski Payme sirli kalit yangilangan
- [ ] Eski Supabase service_role key reset qilingan

### Lokal muhit yangilangan

- [ ] Lokal `.env` fayli yangi qiymatlar bilan yangilangan
- [ ] `npm run dev` muammosiz ishlaydi
- [ ] Lokal Telegram polling ishlaydi (`TELEGRAM_DEV_AUTO_POLL=true`)

---

## Tez-tez so'raladigan savollar

### Qancha vaqt ichida rotatsiya qilish kerak?

- **Darhol** — agar sir git tarixiga yoki ommaviy joyga leak bo'lgan bo'lsa
- **Har 90 kunda** — `AUTH_SECRET`, `ADMIN_SECRET`, `ADMIN_PASSWORD` kabilar uchun
- **Har 180 kunda** — to'lov tizimi kalitlari uchun (provayder talablariga qarang)

### Rotatsiya paytida sayt ishdan chiqadimi?

Ha, qisqa vaqt (1-2 daqiqa) davomida eski token bilan kelgan so'rovlar rad etilishi mumkin. Eng yaxshi vaqt — trafik kam bo'lgan kechasi (O'zbekiston vaqti 02:00-05:00).

### Agar nimadir noto'g'ri ketsa?

1. Backup'dan eski qiymatlarni tiklang
2. Vercel'da eski environment variable'larni qaytaring
3. Redeploy qiling
4. Muammoni aniqlang va qaytadan urinib ko'ring

---

> 📖 Batafsil ma'lumot uchun qarang:
> - [`docs/security-action-required.md`](../security-action-required.md)
> - [`docs/launch/security-rotation-checklist.md`](launch/security-rotation-checklist.md)
> - [`scripts/generate-secrets.ps1`](../scripts/generate-secrets.ps1)
