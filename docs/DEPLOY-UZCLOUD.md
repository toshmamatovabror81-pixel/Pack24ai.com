# pack24.uz ni UzCloud serveriga joylash

Sayt bitta serverda Docker orqali ishlaydi: `web` (Next.js), `db` (Postgres 16), `caddy` (HTTPS).
Baza va rasmlar serverning o'zida saqlanadi, tashqi xizmat (Supabase, Vercel) kerak emas.

## 1. Server

UzCloud (cloud.uz) kabinetida virtual server oching:

| Parametr | Tavsiya |
|---|---|
| OS | Ubuntu 24.04 (yoki 22.04) |
| CPU / RAM | 2 vCPU / 4 GB (boshlang'ich: 2 GB ham yetadi) |
| Disk | 40 GB SSD |
| Tarmoq | statik (oq) IP |

SSH kalit yoki parol bilan `root` kirishini yoqing.

## 2. DNS

Domen boshqaruvida (pack24.uz qayerda ro'yxatdan o'tgan bo'lsa) ikkita A yozuv:

```
pack24.uz      A   <server IP>
www.pack24.uz  A   <server IP>
```

DNS tarqalgach (odatda 5-30 daqiqa) Caddy sertifikatni o'zi oladi.

## 3. O'rnatish (bir marta)

Serverga SSH orqali kirib, bitta buyruq:

```bash
curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/pack24ai.com/main/deploy/server-setup.sh | sudo bash
```

Skript nima qiladi:

1. Docker o'rnatadi, firewall'da faqat 22/80/443 ni ochadi.
2. Kodni `/opt/pack24` ga klon qiladi.
3. `.env` yaratadi: baza paroli, `AUTH_SECRET` va birinchi admin parolini o'zi generatsiya qiladi (admin parolini terminalga bir marta chiqaradi).
4. `docker compose up -d --build` — birinchi build 3-5 daqiqa.
5. Birinchi ishga tushishda migratsiyalar va 120 mahsulotli katalog avtomatik yuklanadi.

Tekshirish: `curl -s https://pack24.uz/api/health` → `{"ok":true,"db":"up"}`.

Admin panel: `https://pack24.uz/admin` (login `admin`, skript bergan parol). Kirgach **Xodimlar** bo'limida parolni almashtiring.

## 4. To'lov va Telegram kalitlari

`/opt/pack24/.env` faylini oching (`nano /opt/pack24/.env`), quyidagilarni to'ldiring va `docker compose up -d` qiling:

- `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY` (Payme Business kabineti; webhook: `https://pack24.uz/api/payment/payme/webhook`)
- `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` (webhook: `https://pack24.uz/api/payment/click`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (yangi buyurtma va arizalar xabari)

Admin > Sozlamalar sahifasida qaysi ulanish ishlayotgani ko'rinadi.

## 5. Yangilash

Qo'lda:

```bash
/opt/pack24/deploy/deploy.sh
```

Avtomatik: GitHub repo > Settings > Secrets and variables > Actions ga `DEPLOY_HOST` (server IP), `DEPLOY_USER` (`root`), `DEPLOY_SSH_KEY` (serverga kiradigan private key) qo'shilsa, `main` ga har bir push serverga o'zi tushadi (`.github/workflows/deploy.yml`).

## 6. Zaxira nusxa

Har kuni 03:00 da baza va rasmlar `/var/backups/pack24` ga saqlanadi (14 kun):

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/pack24/deploy/backup.sh >> /var/log/pack24-backup.log 2>&1") | crontab -
```

Tiklash buyruqlari `deploy/backup.sh` oxirida.

## 7. Foydali buyruqlar

```bash
cd /opt/pack24
docker compose ps                  # holat
docker compose logs -f web         # sayt loglari
docker compose logs -f caddy       # HTTPS / so'rovlar
docker compose exec db psql -U pack24 pack24   # bazaga kirish
docker compose restart web         # qayta ishga tushirish
```

## Supabase'dagi ma'lumotlarni ko'chirish (ixtiyoriy)

Yangi serverga katalog o'zi yuklanadi. Agar Supabase'da keyin qo'shilgan buyurtma yoki mijozlar bo'lsa, u yerdan `pg_dump --data-only` olib, serverda `docker compose exec -T db psql -U pack24 pack24 < dump.sql` bilan yuklash mumkin.
