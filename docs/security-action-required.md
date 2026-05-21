# SECURITY ACTION REQUIRED

Ushbu hujjat **darhol** bajarilishi kerak bo'lgan qo'lda amallarni o'z ichiga oladi. Sabab: bir nechta sirlar va lokal DB fayl git tarixiga commit qilingan.

## 1. Git index'dan olib tashlangan fayllar

Quyidagi fayllar `git rm --cached` orqali index'dan chiqarildi va `.gitignore` da allaqachon bor:

- `BOT_TOKENS.env`
- `dev.db`
- `prisma/dev.db`

**Lekin** ular hali git **tarixida** mavjud. To'liq tozalash uchun pastda 3-bosqichga qarang.

## 2. Rotatsiya qilinishi MAJBURIY tokenlar

Quyidagilarning barchasini yangi qiymatlarga almashtiring. Eski qiymatlarni provayder tomonidan bekor qiling.

### Telegram botlar (BotFather'da)
- `CUSTOMER_BOT_TOKEN` (Pack24AI_bot) → `/revoke` → yangi token
- `DRIVER_BOT_TOKEN` (pack24MX_bot) → `/revoke` → yangi token
- `ADMIN_BOT_TOKEN` (pack24AUP_bot) → `/revoke` → yangi token
- `PACK24ADMIN_BOT_TOKEN` (pack24admin_bot) → `/revoke` → yangi token

### To'lov tizimlari
- `CLICK_SECRET_KEY` — Click merchant kabinetida
- `CLICK_MERCHANT_USER_ID` — agar leak ehtimoli bor bo'lsa
- `PAYME_SECRET_KEY` — Payme merchant kabinetida
- `PAYME_TEST_SECRET` — Payme test/sandbox

### Auth va Admin
- `AUTH_SECRET` — yangi 32+ belgili tasodifiy qiymat (`openssl rand -base64 32`)
- `ADMIN_SECRET` — yangi tasodifiy qiymat (HMAC kalit)
- `ADMIN_PASSWORD` — yangi murakkab parol
- `DRIVER_TOKEN_SECRET` — **yangi env** (M2 audit bo'yicha qo'shildi), `ADMIN_SECRET` dan farqli bo'lsin

### Telegram operatsion sirlar
- `TELEGRAM_OPS_SECRET`
- `TELEGRAM_WEBHOOK_SECRET`

### Tashqi servislar
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → Reset service_role key
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys` bilan yangisini yarating
- `GEMINI_API_KEY` — Google AI Studio'da bekor qiling va yangisini yarating

### DB credential (ehtimoliy)
- `DATABASE_URL` / `DIRECT_URL` — agar Neon dashboard'da rotation funksiyasi bor bo'lsa, parolni yangilang

## 3. Git tarixini tozalash (DESTRUCTIVE — koordinatsiya kerak)

Eski commit'lardan sirlarni butunlay olib tashlash uchun:

```bash
# 1. Repo'ning to'liq backup'ini oling (boshqa kataloglarda):
git clone --mirror . ../pack24-web-backup-$(date +%Y%m%d).git

# 2. git-filter-repo o'rnatish (Windows uchun):
#    pip install git-filter-repo

# 3. Sirlarni tarixdan olib tashlash:
git filter-repo --invert-paths --path BOT_TOKENS.env --path dev.db --path prisma/dev.db --force

# 4. Remote bor bo'lsa — koordinatsiya:
#    a) Hamma developerlarga ogohlantiring
#    b) Force-push:
#       git push --force --all
#       git push --force --tags
#    c) Hamma o'z lokal repo'sini qayta clone qilsin
```

**Diqqat:** force-push tarixni o'zgartiradi, hamkasblar bilan koordinatsiya MAJBURIY. Bu qadamni AI agent avtomatik bajarmaydi — uni qo'lda yoki maxsus tasdiqdan keyin bajaring.

## 4. Qaytadan kompromat oldini olish

`.gitignore` allaqachon to'g'ri sozlangan. Qo'shimcha:

- `.husky/pre-commit` ga `gitleaks` qo'shish (CI bosqichida ham takrorlash)
- `.github/workflows/ci.yml` ichida `gitleaks` step (P3.3 da bajariladi)

## 5. Tasdiqlash

Quyidagi buyruq **bo'sh natija** chiqarishi kerak:

```bash
git ls-files | grep -E '(\.env$|\.db$|BOT_TOKENS)'
```

History tozalangach (3-bosqich):

```bash
git log --all --full-history -- BOT_TOKENS.env dev.db prisma/dev.db
# bo'sh bo'lishi kerak
```
