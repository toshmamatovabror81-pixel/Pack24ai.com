# Bosqich 2 — Telegram WebApp

Repo ichidagi mobil qatlam: `src/app/(mobile)/mobile/`

## URL

Production: **https://pack24.uz/mobile**

Sahifalar:
- `/mobile` — bosh
- `/mobile/catalog` — katalog
- `/mobile/cart` — savat
- `/mobile/orders` — buyurtmalar
- `/mobile/profile` — profil

## Sozlash

1. Bosqich 1 production deploy tugagan bo'lsin
2. Customer bot webhook o'rnatilgan bo'lsin ([telegram-webhooks.md](./telegram-webhooks.md))
3. WebApp menu button avtomatik o'rnatiladi (`configureCustomerWebAppMenu`)

## BotFather (qo'lda, ixtiyoriy)

BotFather → Bot Settings → Menu Button → Configure menu button → Web App:
- URL: `https://pack24.uz/mobile`
- Title: Do'kon

Kod orqali ham o'rnatiladi — ikkala usul bir xil natija.

## Tekshiruv

Telefon Telegram'da:
1. @Pack24AI_bot oching
2. Pastdagi **Do'kon** tugmasini bosing
3. Katalog yuklanishi, mahsulot ochilishi kerak
4. Savatga qo'shish → `/api/cart` ishlashi

## API bog'liqlik

WebApp NextAuth session yoki Telegram initData orqali auth qiladi. Production'da:
- `NEXT_PUBLIC_APP_URL=https://pack24.uz`
- CORS: `ALLOWED_ORIGINS` da Telegram domain kerak emas (same-origin WebApp)

## Keyingi bosqich

Native Expo ilova: [bosqich-3-customer-expo.md](./bosqich-3-customer-expo.md)
