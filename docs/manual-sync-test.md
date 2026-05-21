# Qo'lda sinxron test — web, admin, mobil

Barcha sirtlar **bitta backend** (`pack24-web`) va **bitta Neon DB** ga ulanadi.
O'zgarish bir joyda qilinsa, boshqalarda ham ko'rinishi kerak.

## Tez ishga tushirish

```powershell
cd c:\pack24-web
npm run dev:all
```

Yoki alohida terminalda:

```powershell
npm run dev
```

`.env` da bo'lishi kerak:

```env
TELEGRAM_DEV_AUTO_POLL=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

## Havolalar

| Sirt | URL |
|------|-----|
| Web sayt | http://localhost:3000 |
| Admin login | http://localhost:3000/admin/login |
| Admin dashboard | http://localhost:3000/admin/dashboard |
| Mobil TWA (Telegram Web App) | http://localhost:3000/mobile |
| Recycling admin | http://localhost:3000/admin/recycling |

**Admin kirish:** `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD`

## Telegram botlar (2 ta “mobil” oqim)

Telegramda oching va `/start` yuboring:

| Rol | Bot |
|-----|-----|
| Mijoz | @Pack24AI_bot |
| Haydovchi | @pack24MX_bot |

**Sinxron test misoli (recycling):**

1. Mijoz botda makulatura arizasi yuboring
2. Admin panel → **Recycling** → ariza paydo bo'lishi kerak
3. Admin arizani haydovchiga biriktiring
4. Haydovchi botda yangi vazifa ko'rinishi kerak
5. Haydovchi statusni yangilasa → admin panelda status o'zgarishi kerak

## Native mobil ilovalar (Expo)

Loyihalar kompyuteringizda:

| Ilova | Papka | Expo port |
|-------|-------|-----------|
| **Pack24AI** (mijoz) | `C:\pack24-mobile\apps\customer` | 8081 |
| **Pack24 Driver** | `C:\pack24-driver` | 8082 |

Ishga tushirish (2 ta alohida terminal):

```powershell
# Terminal 1 — Pack24AI
cd C:\pack24-mobile\apps\customer
npx expo start --port 8081

# Terminal 2 — Pack24 Driver
cd C:\pack24-driver
npx expo start --port 8082
```

Telefonda **Expo Go** ilovasini o'rnating, QR kodni skanerlang.

API allaqachon `http://192.168.0.113:3000` ga ulangan (pack24-web bilan bir Wi-Fi).

---

## Native mobil ilovalar (eski qo'llanma)

Agar sizda **alohida** `pack24-customer` va `pack24-driver` repo'lari bo'lsa:

### API bazasi

| Qurilma | URL |
|---------|-----|
| Emulyator (Android) | `http://10.0.2.2:3000` |
| iOS Simulator | `http://localhost:3000` |
| Haqiqiy telefon (bir Wi-Fi) | `http://<kompyuter-IP>:3000` (masalan `http://192.168.0.113:3000`) |

Kompyuter IP: `ipconfig` → IPv4.

### Auth endpointlar

- **Mijoz ilova:** `POST /api/auth/send-otp` → `POST /api/auth/mobile/verify-otp`
- **Haydovchi ilova:** `POST /api/auth/driver/login` (telefon + parol)

Mobil ilova `API_URL` / `EXPO_PUBLIC_API_URL` ni yuqoridagi bazaga qo'ying.

## Sinxronlikni tekshirish checklist

- [ ] Web saytda mahsulotlar ko'rinadi (`/`)
- [ ] Admin panelga kirish mumkin (`/admin/login`)
- [ ] Admin → Orders ro'yxati DB bilan mos
- [ ] Mijoz botda ariza → Admin recycling da yangi qator
- [ ] Admin dispatch → Haydovchi botda bildirishnoma
- [ ] `/api/admin/sse` — admin panelda **LIVE** yashil indikator
- [ ] (ixtiyoriy) Native mijoz ilova login → web profil/orders bilan bir xil user

## Muammo bo'lsa

1. Faqat **bitta** `npm run dev` ishlasin (3000-port band bo'lmasin)
2. `NEXT_PUBLIC_APP_URL` dev'da `http://localhost:3000` bo'lsin
3. Botlar jim bo'lsa: http://localhost:3000/api/telegram/start-polling oching
4. Sekin bo'lsa: birinchi sahifa kompilatsiyasi 10–20s — keyin tezlashadi
