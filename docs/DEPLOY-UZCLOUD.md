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

Serverga SSH orqali kirib (`ssh root@<server IP>`), bitta buyruq. `<branch>` o'rniga joylanadigan branch nomi
(PR #3 qo'shilguncha `claude/site-rewrite-um3xxf`, keyin `main`):

```bash
curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/Pack24ai.com/<branch>/deploy/server-setup.sh | sudo BRANCH=<branch> bash
```

Skript nima qiladi:

1. git, Docker o'rnatadi, firewall'da faqat 22/80/443 ni ochadi.
2. Kodni `/opt/pack24` ga klon qiladi.
3. `.env` yaratadi: baza paroli, `AUTH_SECRET` va birinchi admin parolini o'zi generatsiya qiladi.
4. Cron: har 5 daqiqada GitHub'dan yangilanish (`deploy/auto-update.sh`), har kuni 03:00 da zaxira (`deploy/backup.sh`).
5. `docker compose up -d --build` (birinchi build 3-5 daqiqa), migratsiyalar va 120 mahsulotli katalog avtomatik yuklanadi.
6. Sayt javob berganda `TAYYOR` va admin parolini ekranga chiqaradi (parol `/opt/pack24/.env` da ham bor).

Tekshirish: `curl -s https://pack24.uz/api/health` → `{"ok":true,"db":"up"}`.

Admin panel: `https://pack24.uz/admin` (login `admin`, skript bergan parol). Kirgach **Xodimlar** bo'limida parolni almashtiring.

### Serverda boshqa sayt (nginx) bo'lsa

Agar shu serverda allaqachon boshqa sayt ishlayotgan bo'lsa (masalan nginx 80 va 443 portlarni egallagan), skript buni
o'zi sezadi va **nginx rejimi**da o'rnatadi (qo'lda: `PROXY=nginx`):

- Caddy ishga tushmaydi; sayt faqat `127.0.0.1:WEB_PORT` da tinglaydi (`WEB_PORT` `.env` ga yoziladi, standart 3010).
- `deploy/compose.proxy.yml` `docker-compose.override.yml` sifatida nusxalanadi (git'ga kirmaydi, yangilanishda saqlanadi).
- Mavjud nginx'ga `deploy/nginx-pack24.conf` asosida `/etc/nginx/sites-available/pack24.uz` bo'limi qo'shiladi
  (oldin `/root/nginx-backup-*.tgz` zaxira olinadi), `nginx -t` o'tsa qayta yuklanadi.
- `certbot --nginx` bepul HTTPS sertifikat oladi va 80 → 443 yo'naltirishni qo'shadi. DNS hali tarqalmagan bo'lsa,
  keyinroq: `certbot --nginx -d pack24.uz -d www.pack24.uz --redirect`.
- Firewall sozlamalariga tegilmaydi (boshqa saytning portlari yopilib qolmasligi uchun).

Agar 80/443 ni egallagan nginx konteyner ichida bo'lsa, skript faqat eslatma chiqaradi: o'sha nginx'da
`pack24.uz → 127.0.0.1:WEB_PORT` yo'naltirishni qo'lda qo'shasiz (namuna: `deploy/nginx-pack24.conf`).

## 4. To'lov va Telegram kalitlari

`/opt/pack24/.env` faylini oching (`nano /opt/pack24/.env`), quyidagilarni to'ldiring va
`cd /opt/pack24 && docker compose up -d` qiling:

- `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY` (Payme Business kabineti; webhook: `https://pack24.uz/api/payment/payme/webhook`)
- `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` (webhook: `https://pack24.uz/api/payment/click`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (yangi buyurtma va arizalar xabari)

Admin > Sozlamalar sahifasida qaysi ulanish ishlayotgani ko'rinadi.

### Telegram botlar (2 ta)

Eng oson yo'li — savol-javob skripti (2 ta tokenni so'raydi, `.env` ga yozadi, saytni qayta ishga tushiradi va
webhook'larni o'rnatadi):

```bash
ssh -t -i ~/.ssh/KALIT root@<server IP> /opt/pack24/deploy/bots-setup.sh
```

Qo'lda: BotFather'dan olingan tokenlarni `/opt/pack24/.env` ga yozing (`nano /opt/pack24/.env`):

- `CUSTOMER_BOT_TOKEN` — mijoz boti (@Pack24AI_bot)
- `STAFF_BOT_TOKEN` — boshqaruv boti (@pack24AUP_bot), xodimlar uchun (eski nomi `SUPERVISOR_BOT_TOKEN` ham qabul qilinadi)
- `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_OPS_SECRET` — o'rnatish skripti o'zi yaratgan, o'zgartirmang

Keyin `cd /opt/pack24 && docker compose up -d` qiling va Admin > Sozlamalar > "Telegram botlar" bo'limida
**"Webhook'larni o'rnatish"** tugmasini bosing (sayt HTTPS bilan ochilgan bo'lishi shart). Shu sahifada har bot
holati (@username, webhook, xatolar) ko'rinadi.

Eski botlarni o'chirib qo'ying (yoki tokenlarini BotFather'da yangilang) — bitta tokenga faqat bitta webhook bo'ladi.

Makulatura yo'nalishi olib tashlangan: haydovchi boti (@pack24MX_bot) endi ishlatilmaydi — BotFather'da tokenini
bekor qiling yoki botni o'chiring. Serverdagi `.env` da qolgan `DRIVER_BOT_TOKEN` va `HQ_ALLOWED_TELEGRAM_IDS`
satrlari endi o'qilmaydi, ularni o'chirib tashlash mumkin.

Agar boshqaruv boti shu versiyadan oldin ulangan bo'lsa: uning webhook manzili `/api/telegram/supervisor` dan
`/api/telegram/staff` ga o'zgardi. Eski manzil ham qabul qilinadi, lekin bot buyruqlari menyusi yangilanishi uchun
Admin > Sozlamalar > "Telegram botlar" bo'limida **"Webhook'larni o'rnatish"** tugmasini bir marta bosing.

Mijozlar ariza bilan yuborgan makulatura rasmlari (agar bo'lgan bo'lsa) rasmlar volume'ida qoladi
(`/data/uploads/recycling`): admin panelda ko'rinmaydi, lekin havolasi bo'yicha ochilaveradi. Kerak bo'lmasa,
yangilanish muvaffaqiyatli o'tgach bir marta o'chiring:

```bash
cd /opt/pack24 && docker compose exec -T web rm -rf /data/uploads/recycling
```

## 5. Yangilash

Avtomatik: server har 5 daqiqada GitHub'dagi o'z branch'ini tekshiradi; yangi commit bo'lsa `deploy/deploy.sh` ni
ishga tushiradi (log: `/var/log/pack24-update.log`). Branch GitHub'da o'chirilsa (PR `main` ga qo'shilgach) server
o'zi `main` ga o'tadi. Hech qanday kalit kerak emas.

Yangi commit baza migratsiyasi (`prisma/migrations`) olib kelsa, `deploy.sh` kodni almashtirishdan **oldin**
`deploy/backup.sh` ni ishga tushiradi. Zaxira o'tmasa yangilanish to'xtaydi (eski versiya ishlayveradi) va 5 daqiqadan
keyin qayta uriniladi. Zaxirasiz davom ettirish (faqat ongli ravishda): `SKIP_BACKUP=1 /opt/pack24/deploy/deploy.sh`.

Qo'lda: `/opt/pack24/deploy/deploy.sh`

Ixtiyoriy (SSH orqali push'dan keyin darhol): GitHub repo > Settings > Secrets and variables > Actions ga
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` qo'shilsa, `.github/workflows/deploy.yml` ham ishlaydi.

## 6. Zaxira nusxa

Har kuni 03:00 da baza va rasmlar `/var/backups/pack24` ga saqlanadi (14 kun), cron'ni o'rnatish skripti qo'shadi.
Bundan tashqari har bir yangi baza migratsiyasidan oldin ham zaxira olinadi (5-bo'lim): baza nusxasi
`premigration-YYYY-MM-DD_HHMM.sql.gz` nomi bilan saqlanadi va 14 kunlik tozalashga **tushmaydi** — kerak bo'lmay
qolganda qo'lda o'chiriladi. Papka faqat `root` uchun ochiq (nusxalarda mijozlar ma'lumoti bor).

Tiklash tartibi `deploy/backup.sh` oxirida. Muhim: nusxa faqat bo'sh bazaga to'g'ri tushadi, shuning uchun avval
baza qayta yaratiladi (ishlab turgan baza ustiga quyish aralash holat qoldiradi).

## 7. Foydali buyruqlar

```bash
cd /opt/pack24
docker compose ps                  # holat
docker compose logs -f web         # sayt loglari
docker compose logs -f caddy       # HTTPS / so'rovlar
docker compose exec db psql -U pack24 pack24   # bazaga kirish
docker compose restart web         # qayta ishga tushirish
tail -f /var/log/pack24-update.log # avtomatik yangilanish logi
```

## Supabase'dagi ma'lumotlarni ko'chirish (ixtiyoriy)

Yangi serverga katalog o'zi yuklanadi. Agar Supabase'da keyin qo'shilgan buyurtma yoki mijozlar bo'lsa, u yerdan
`pg_dump --data-only` olib, serverda `docker compose exec -T db psql -U pack24 pack24 < dump.sql` bilan yuklash mumkin.
