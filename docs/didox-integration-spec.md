# F1 — Didox.uz EDI integratsiyasi (texnik spesifikatsiya)

Bu hujjat **kelajakdagi sprint** uchun tayyorlangan oldindan loyihalash.
Yangilangan reja bo'yicha F1 alohida vazifa va foydalanuvchi rasmiy
buyurtma berishidan keyin amalga oshiriladi.

## 1. Maqsad

`Didox.uz` — O'zbekistondagi davlat ruxsat etgan elektron-hisob-faktura
operatori. Pack24-web ichida mavjud `admin/invoices/*` modul hozir
faqat **ichki PDF chiqarish** qiladi. Bu vazifa quyidagilarni ulashni nazarda tutadi:

1. Sotuvdan keyin avtomatik EHF (elektron hisob-faktura) yaratish
2. Didox API'ga yuborish, statusni saqlash
3. Mijozning Didox kabinetida tasdiqlash uchun yo'naltirish
4. Webhook orqali status yangilanishlari

## 2. Texnik talablar

### 2.1 Kirish ma'lumotlari
- `DIDOX_LOGIN` — kompaniya STIR (INN)
- `DIDOX_PASSWORD` — Didox API parol (rotatsiyasi `docs/security-action-required.md`'ga qo'shiladi)
- `DIDOX_API_BASE_URL` — odatda `https://core.didox.uz/api/`

### 2.2 Endpointlar (Didox documentation'dan)
- `POST /v1/auth/login` — JWT token olish
- `POST /v1/documents/create` — EHF yuborish
- `GET /v1/documents/{id}` — status tekshirish
- `POST /v1/documents/sign` — elektron imzo

### 2.3 Pack24 tomoni
- `src/lib/integrations/didox/client.ts` — HTTP client (auth + retry)
- `src/lib/integrations/didox/mapper.ts` — `Invoice` → Didox XML/JSON
- `src/lib/integrations/didox/webhook.ts` — status webhook handler
- `src/app/api/admin/invoices/[id]/didox/send/route.ts` — yuborish trigger
- `src/app/api/webhooks/didox/route.ts` — status callback
- Prisma schema'da `Invoice.didoxId String?`, `Invoice.didoxStatus String?`, `Invoice.didoxSentAt DateTime?` qo'shish

## 3. Migratsiya bosqichlari

| Bosqich | Tafsilot | Vaqt |
|---|---|---|
| Sandbox | Didox test API'ga ulanish, fake STIR ishlatish | 2 kun |
| EHF mapper | Invoice modelidan XML/JSON shabloni | 3 kun |
| Webhook flow | Status callback + DB yangilash | 1 kun |
| Admin UI | "Didox'ga yuborish" tugmasi va status timeline | 2 kun |
| Production | Real STIR bilan ishga tushirish | 1 kun |
| Stabilizatsiya | Edge case'lar, retry, monitoring | 3 kun |

## 4. Xavf

- Didox sertifikati va elektron imzo — qonun talablari
- Mijoz STIR'i noto'g'ri bo'lsa Didox rad etadi
- Rate limit: Didox API'da odatda 100 req/min — `src/lib/rateLimit.ts` integratsiyasi
- Schema migratsiyasi — `Invoice` modeli o'zgaradi

## 5. Holat

**Hozir:** maqset hujjatlangan. Implementatsiya boshlash uchun
foydalanuvchidan tasdiq talab etiladi (Didox akkaunti va kontrakt
mavjudligi sharti).
