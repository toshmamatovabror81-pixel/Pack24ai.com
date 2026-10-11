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
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (yangi buyurtma va arizalar haqida admin guruhiga xabar)

Admin > Sozlamalar sahifasida qaysi ulanish ishlayotgani ko'rinadi.

### Telegram botlar (2 ta)

Ikkala bot ham admin panel bilan bitta bazada ishlaydi — alohida dastur yoki server kerak emas.

**Mijoz boti** (@Pack24AI_bot). Mijoz o'z buyurtmalarini (ro'yxatga olingan sana, hozirgi holat va ishlab chiqarish
bosqichi, summa, to'lov), balansini, sotuvchi rekvizitlari va aloqa ma'lumotlarini ko'radi. "Balans" — oldindan
to'langan hamyon emas, mijozning qarzi: ochiq hisob-fakturalar, ularning muddati o'tgan qismi, shartnomadagi nasiya
limiti va to'lanmagan buyurtmalar. Buyurtma holati o'zgarsa, to'lov qabul qilinsa, hisob-faktura berilsa yoki
ishlab chiqarish bosqichi almashsa bot mijozga o'zi xabar yuboradi (o'zbek yoki rus tilida — mijoz botda tanlaydi).

Mijoz ikki yo'l bilan ulanadi:

- botda **o'z telefon raqamini ulashadi** (bot tugmasi orqali). Shu raqam bilan berilgan barcha buyurtmalar ko'rinadi.
  Raqamni yozib yuborish qabul qilinmaydi — faqat Telegram tasdiqlagan o'z kontakti;
- saytdagi buyurtma sahifasida **"Telegram'da kuzatish"** tugmasini bosadi — shu bitta buyurtma chatga ulanadi va
  holati o'zgarsa xabar keladi (telefon ulashmasdan ham). Tugma faqat mijoz boti tokeni kiritilgandan keyin chiqadi
  (token yo'q paytda bot javob bermaydi).

Saytdagi Telegram tugmalari Admin > Sozlamalar > Aloqa > "Telegram bot (mijozlar uchun)" maydonidagi botga olib
boradi — u yerda mijoz botining nomi (`Pack24AI_bot`, @ belgisisiz) turishi kerak.

**Boshqaruv boti** (@pack24AUP_bot) — xodimlar uchun. Yangi buyurtma va to'lov xabarlari tugmalari bilan keladi
(qabul qilish, jo'natildi, yetkazildi, bekor qilish, naqd yoki o'tkazma to'landi), buyurtma holati botning o'zidan
o'zgartiriladi, buyurtmalarni qidirish, bugungi raqamlar va muddati o'tgan qarzlar ko'rinadi. Botdagi amal admin
paneldagi bilan bir xil ishlaydi: mijozga xabar ketadi, buyurtma sahifasidagi "Tarix"da esa kim, qachon va qayerdan
(admin panel, boshqaruv boti, Payme, Click, hisob-faktura) o'zgartirgani yoziladi.

Xodim ikki yo'l bilan ulanadi (faqat Admin > Xodimlar ro'yxatidagi faol xodimlar):

- botda /start bosib **o'z telefon raqamini ulashadi** — raqam Xodimlar ro'yxatidagi telefon bilan bir xil bo'lsa
  bot darhol ulanadi;
- yoki admin **Admin > Xodimlar > "Telegram kodi"** tugmasini bosadi va chiqqan 6 xonali kodni xodimga aytadi, xodim
  kodni botga yozadi. Kod 30 daqiqa amal qiladi va bir marta ishlaydi (telefonsiz "admin" logini uchun ham shu yo'l).
  Boshqaruv boti tokeni kiritilmaguncha tugma yashirin turadi va sahifada bu haqda ogohlantirish chiqadi.

Ruxsatlar admin paneldagi rol bilan bir xil; xodim o'chirilsa yoki "Faol" belgisi olinsa botdan ham darhol uziladi.
Xodimlar sahifasida har bir xodim uchun "Telegram xabar" belgisi (xabarnomalarni o'chirib qo'yish) va "Uzish" tugmasi bor.

Eski tizimdan qolgan Telegram ulanishlari (`User.telegramId`) `6_bots_orders` migratsiyasida bir marta bekor qilinadi:
ularni eski botlar zaifroq tekshiruv bilan yozgan. Ilgari ulangan xodim yuqoridagi ikki yo'ldan biri bilan qayta ulanadi.

**Xabarnomalar va kunlik eslatma.** Yangi buyurtma, onlayn to'lov (Payme, Click) va to'langan hisob-faktura haqida
"buyurtmalar" ruxsati bor xodimlarga, yangi ariza haqida "arizalar" ruxsati bor xodimlarga xabar boradi. Har kuni
soat 09:00 dan keyin (Toshkent vaqti) bir marta eslatma yuboriladi: muddati o'tgan hisob-fakturalar ("moliya" ruxsati
bor xodimlarga) va 24 soatdan beri "Yangi" holatida turgan buyurtmalar. Eslatma uchun alohida sozlash kerak emas:
uni avtomatik yangilanish cron'i (`deploy/auto-update.sh`, har 5 daqiqada) ishga tushiradi. Qo'lda tekshirish:

```bash
cd /opt/pack24 && docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/cron/tick',{method:'POST',headers:{authorization:'Bearer '+process.env.TELEGRAM_OPS_SECRET}}).then(async r=>console.log(r.status,await r.text()))"
```

Javob `200 {"ok":true,"digest":null,"audit":null}` bo'lsa hammasi joyida (bugungi eslatma va tekshiruv allaqachon bajarilgan
yoki vaqti hali kelmagan: tekshiruv 08:00 dan, eslatma 09:00 dan keyin); `"digest":{...}` — eslatma shu so'rov bilan yuborildi
(nechta xodimga yetgani ko'rsatiladi); `"audit":{"findings":..,"sent":..,"ai":..}` — kunlik tekshiruv shu so'rov bilan bajarildi,
`"audit":"running"` — u fonda davom etyapti, `"audit":"failed"` — xato bilan tugadi (`docker compose logs web`; bugun takrorlanmaydi,
kerak bo'lsa Admin > AI tekshiruv > «Hozir tekshirish»). Diqqat: bu buyruq vaqti kelgan
tekshiruv va eslatmani haqiqatan ishga tushiradi — xodimlarga xabar ketadi.

Cron signali o'tmasa (web konteyneri ishlamayapti, `.env` da `TELEGRAM_OPS_SECRET` yo'q yoki ilova xato qaytardi),
`/var/log/pack24-update.log` ga sababi bilan bitta `cron tick o'tmadi: ...` satri yoziladi. Nosozlik davom etsa satr
takrorlanmaydi (sababi o'zgarsa — yangi satr yoziladi), signal yana o'tgach esa keyingi nosozlikda qayta yoziladi. Yangilanish bunga qaramay davom etaveradi.

`TELEGRAM_BOT_TOKEN` va `TELEGRAM_ADMIN_CHAT_ID` orqali admin guruhiga boradigan xabarlar avvalgidek, botlardan
mustaqil ishlaydi.

#### Botlarni ulash

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
**"Webhook'larni o'rnatish"** tugmasini bosing (sayt HTTPS bilan ochilgan bo'lishi shart) — tokenlar yozilgandan
keyin bu majburiy: tugma bosilmaguncha botlar xabar qabul qilmaydi. Shu sahifada har bot holati (@username, webhook,
xatolar) ko'rinadi. Token almashtirilganda yoki botlarga yangi buyruqlar qo'shilgan yangilanishdan keyin ham tugmani
bir marta bosing — Telegram'dagi buyruqlar menyusi (/orders, /balance, /new, /find va boshqalar) shunda yangilanadi.

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

### Sun'iy intellekt (Claude)

Ixtiyoriy. Anthropic API kaliti kiritilsa ikki narsa yoqiladi:

- **Mijoz botidagi yordamchi.** Mijoz menyudan tashqari savolini oddiy matn bilan yozsa («buyurtmam qayerda?», «qancha
  qarzim bor?», «karton quti narxi qancha?»), Claude o'zbek yoki rus tilida javob beradi. Yordamchi ma'lumotni faqat
  shu mijozning o'z buyurtmalari, balansi, katalog, savol-javob va kompaniya ma'lumotlaridan oladi — boshqa mijozning
  ma'lumotini so'rab ololmaydi (so'rovlarda «kimniki» degan parametr yo'q, hammasi shu chat egasiga bog'langan). U hech
  narsani o'zgartirmaydi: buyurtma bermaydi, bekor qilmaydi, to'lov qabul qilmaydi.
- **Kunlik tekshiruv xulosasi.** Har kuni 08:00 dan keyin tizim e'tibor talab qiladigan narsalarni bazadan aniq qoidalar
  bo'yicha yig'adi (javobsiz yoki to'langan-u qabul qilinmagan buyurtmalar, muddati o'tgan hisob-fakturalar, kechikkan
  ishlab chiqarish, kam qoldiq va h.k.) — bu qism AI'siz ham ishlaydi. Kalit bo'lsa Claude ularni muhimligi bo'yicha
  tartiblab, bugun nima qilish kerakligini yozadi. Natija: Admin > **AI tekshiruv** sahifasi va boshqaruv boti
  («Hisobotlar» ruxsati bor xodimlarga). Sahifadagi «Hozir tekshirish» tugmasi tekshiruvni istalgan payt bajaradi.

Anthropic'ga nima yuboriladi: mijoz botida — mijozning savoli va unga javob berish uchun kerak bo'lgan o'z ma'lumotlari;
kunlik tekshiruvda — faqat sonlar hamda buyurtma va hisob-faktura raqamlari (mijoz ismi, telefoni, manzili yuborilmaydi).

Ulash (kalit ekranda ko'rinmaydi, faqat serverdagi `.env` ga yoziladi; skript modelni va kunlik chegarani ham so'raydi,
saytni qayta ishga tushiradi va kalitni haqiqiy so'rov bilan sinaydi):

```bash
ssh -t -i ~/.ssh/KALIT root@<server IP> /opt/pack24/deploy/ai-setup.sh
```

Kalit: console.anthropic.com > API Keys > Create Key; hisobda mablag' bo'lishi kerak (Billing). Xarajat modelga bog'liq:
bitta mijoz savoli taxminan 3–5 sent (`claude-opus-5-5`, standart), 2 sent atrofida (`claude-sonnet-5-5`) yoki 1 sentdan
ancha kam (`claude-haiku-5-5`). Xarajat chegaralanadi: kuniga jami `AI_DAILY_LIMIT` (standart 300) va bitta mijozga
`AI_CUSTOMER_DAILY_LIMIT` (standart 20; telefonini ulamagan chatga — 3) so'rov; chegaradan keyin bot odatdagi menyu bilan
javob beradi. Kunlik avtomatik xulosa (kuniga bitta so'rov) umumiy chegaraga qaramay bajariladi. Sarf Admin >
AI tekshiruv sahifasida (so'rov va tokenlar) va console.anthropic.com > Usage da (pulda) ko'rinadi.

O'chirish: skriptni qayta ishga tushirib, kalit so'ralganda bitta chiziqcha (`-`) yozing.

## 5. Yangilash

Avtomatik: server har 5 daqiqada GitHub'dagi o'z branch'ini tekshiradi; yangi commit bo'lsa `deploy/deploy.sh` ni
ishga tushiradi (log: `/var/log/pack24-update.log`). Branch GitHub'da o'chirilsa (PR `main` ga qo'shilgach) server
o'zi `main` ga o'tadi. Hech qanday kalit kerak emas.

Shu cron satri ilovaning davriy ishlarini ham ishga tushiradi: har 5 daqiqada `/api/cron/tick` ga signal yuboradi
(Telegram'dagi kunlik eslatma va kunlik tekshiruv, 4-bo'lim). Avtomatik yangilanish cron'dan olib tashlansa, ular ham to'xtaydi.

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

## Ishlab chiquvchilar uchun: testlar

`npm test` bazasiz ishlaydi va `src/lib/__tests__/db` dagi testlarni o'tkazib yuboradi (natijada "skipped" deb chiqadi).
Mijozlar orasidagi ajratish, qarzdorlik hisobi, holat va to'lov o'zgarishi, xodimni botga ulash, checkout aynan shu
testlarda haqiqiy PostgreSQL bilan tekshiriladi. Server yangi commit'ni CI tugashini kutmasdan 5 daqiqada joylaydi,
shuning uchun `src/lib` yoki botlar o'zgarganda push'dan oldin ularni mahalliy ishga tushiring.

Kerak: shu mashinadagi **bo'sh** Postgres 16 bazasi (ishchi baza emas — testlar yozadi va o'chiradi). Git Bash'da:

```bash
export DATABASE_URL=postgresql://postgres@127.0.0.1:5432/pack24_test DIRECT_URL=postgresql://postgres@127.0.0.1:5432/pack24_test
npx prisma migrate deploy                 # bir marta va har yangi migratsiyadan keyin
P24_DB_TESTS=1 npx vitest run             # hamma testlar; faqat bazaviylari: ... npx vitest run src/lib/__tests__/db
```

PowerShell'da o'zgaruvchilar `$env:P24_DB_TESTS='1'; $env:DATABASE_URL='...'; $env:DIRECT_URL='...'` ko'rinishida beriladi.
Himoya: `P24_DB_TESTS=1` bo'lsa ham manzil faqat `localhost`, `127.0.0.1` yoki `postgres` (CI xizmati) bo'lishi shart,
aks holda birorta so'rov ham yuborilmaydi (`src/lib/__tests__/db/helpers.ts`). Poyga testlari bir vaqtda kamida 3 ta
ulanish ochadi — manzilga `connection_limit=1` yoki `2` qo'shmang. GitHub Actions (`.github/workflows/ci.yml`) shu
testlarni vaqtinchalik bazada faqat `main` ga push yoki PR bo'lganda ishga tushiradi — boshqa branch'da ular faqat
mahalliy tekshiriladi.

## Supabase'dagi ma'lumotlarni ko'chirish (ixtiyoriy)

Yangi serverga katalog o'zi yuklanadi. Agar Supabase'da keyin qo'shilgan buyurtma yoki mijozlar bo'lsa, u yerdan
`pg_dump --data-only` olib, serverda `docker compose exec -T db psql -U pack24 pack24 < dump.sql` bilan yuklash mumkin.

Eski foydalanuvchilar shu yo'l bilan `6_bots_orders` migratsiyasidan KEYIN yuklansa, ular bilan birga eski Telegram
ulanishlari ham qaytib keladi (migratsiyadagi tozalash faqat bir marta ishlaydi). Botlarni ulashdan
(`deploy/bots-setup.sh`) oldin tekshiring va tozalang:

```bash
cd /opt/pack24
docker compose exec -T db psql -U pack24 pack24 -c 'SELECT id, name, role, "telegramId" FROM "User" WHERE "telegramId" IS NOT NULL;'
# Qatorlar chiqsa va ular yangi boshqaruv boti orqali ulanmagan bo'lsa (yuklashdan keyin hali hech kim ulanmagan):
docker compose exec -T db psql -U pack24 pack24 -c 'UPDATE "User" SET "telegramId" = NULL, "telegramVerifiedAt" = NULL, "telegramCode" = NULL, "otpExpiry" = NULL WHERE "telegramId" IS NOT NULL OR "telegramCode" IS NOT NULL OR "otpExpiry" IS NOT NULL;'
```
