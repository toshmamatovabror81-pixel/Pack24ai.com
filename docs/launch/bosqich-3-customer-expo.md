# Bosqich 3 — Customer Expo ilova

Tashqi repo: `C:\pack24-mobile\apps\customer`

## Tayyor bo'lish sharti

- [x] Bosqich 1: `https://pack24.uz` API ishlayapti
- [x] Bosqich 2: Telegram WebApp test o'tgan

## API konfiguratsiya

`apps/customer` da `.env` yoki `app.config.ts`:

```
EXPO_PUBLIC_API_URL=https://pack24.uz
```

Asosiy endpoint'lar:
- `POST /api/auth/mobile/verify-otp` — login
- `GET/POST /api/cart` — savat
- `POST /api/orders` — buyurtma
- `GET /api/products` — mahsulotlar

## Lokal ishga tushirish

```powershell
# Terminal 1 — backend
cd C:\pack24-web
npm run dev

# Terminal 2 — customer app
cd C:\pack24-mobile\apps\customer
npm run start:web -- --port 8081
```

Yoki: `npm run dev:mobile` (pack24-web dan)

## Production build (EAS)

```bash
cd C:\pack24-mobile\apps\customer
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

`eas.json` da `EXPO_PUBLIC_API_URL=https://pack24.uz` production profile'da.

## Store internal testing

1. **Google Play** — Internal testing track, APK/AAB upload
2. **TestFlight** — Apple Developer, beta testers

## WebApp bilan sinxron

API kontrakt bir xil — o'zgarishlar ikkala tomonda test qiling:
- WebApp: `/mobile/*`
- Expo: native screens

## Checklist

- [ ] Production API URL sozlangan
- [ ] Auth OTP ishlaydi
- [ ] Savat sync
- [ ] Buyurtma yaratish
- [ ] Push notifications (VAPID, ixtiyoriy)
