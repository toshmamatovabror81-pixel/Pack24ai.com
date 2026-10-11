#!/usr/bin/env bash
# Kunlik zaxira: baza (pg_dump) + yuklangan rasmlar. 14 kunlik nusxalar saqlanadi.
# Cron (har kuni 03:00):  0 3 * * * /opt/pack24/deploy/backup.sh >> /var/log/pack24-backup.log 2>&1
# deploy.sh ham yangi baza migratsiyasi kelganda, uni qo'llashdan oldin shu skriptni chaqiradi
# (BACKUP_PREFIX=premigration): bunday baza nusxalari 14 kunlik tozalashga tushmaydi, qo'lda o'chiriladi.
set -euo pipefail
umask 077 # nusxalarda mijozlar ma'lumoti bor: faqat root o'qiydi
cd "$(dirname "$0")/.."
OUT="${BACKUP_DIR:-/var/backups/pack24}"
PREFIX="${BACKUP_PREFIX:-db}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$OUT"
chmod 700 "$OUT"

# Yarim qolgan fayl tayyor zaxiraga o'xshab qolmasin: avval .tmp, ikkala qadam o'tgach nom beriladi
trap 'rm -f "$OUT/$PREFIX-$STAMP.sql.gz.tmp" "$OUT/uploads-$STAMP.tar.gz.tmp"' EXIT
docker compose exec -T db pg_dump -U pack24 --no-owner pack24 | gzip > "$OUT/$PREFIX-$STAMP.sql.gz.tmp"
docker run --rm -v pack24_uploads:/src:ro -v "$OUT":/out alpine tar czf "/out/uploads-$STAMP.tar.gz.tmp" -C /src .
mv "$OUT/$PREFIX-$STAMP.sql.gz.tmp" "$OUT/$PREFIX-$STAMP.sql.gz"
mv "$OUT/uploads-$STAMP.tar.gz.tmp" "$OUT/uploads-$STAMP.tar.gz"

find "$OUT" -type f -mtime +14 ! -name 'premigration-*' -delete
echo "$STAMP: $(du -sh "$OUT" | cut -f1) jami"

# Faqat kunlik zaxirada (migratsiya oldidan olinadigan nusxada emas — u yangilanishni kechiktirmasin). Ikkalasining xatosi
# zaxiraning o'ziga ta'sir qilmaydi (nusxa allaqachon joyida); natijani deploy/watchdog.sh ko'radi va administratorlarga xabar beradi.
if [ "$PREFIX" = "db" ]; then
  # 1) Zaxirani sinash: yangi nusxa vaqtinchalik bazaga tiklab ko'riladi — ochilmaydigan nusxa zaxira emas
  ./deploy/restore-test.sh "$OUT/$PREFIX-$STAMP.sql.gz" || true
  # 2) Serverdan tashqaridagi nusxa (ixtiyoriy, deploy/offsite-setup.sh yoqadi): shifrlangan nusxa Telegram orqali yuboriladi
  [ "${BACKUP_SKIP_OFFSITE:-0}" = "1" ] || ./deploy/offsite-send.sh "$OUT/$PREFIX-$STAMP.sql.gz" || true
fi

# Tiklash. Nusxa faqat BO'SH bazaga to'g'ri tushadi: ishlab turgan baza ustiga quyilsa psql xatolarni o'tkazib
# yuboradi va baza aralash holatda qoladi. Shuning uchun tartib:
#   1) Avtomatik yangilanishni vaqtincha to'xtating (crontab -e yoki /etc/cron.d/pack24 da auto-update.sh satrini
#      # bilan yoping) — aks holda 5 daqiqadan keyin yangi kod yana ishga tushadi.
#   2) docker compose stop web
#   3) docker compose exec -T db dropdb -U pack24 --force pack24 && docker compose exec -T db createdb -U pack24 pack24
#   4) gunzip -c db-YYYY-MM-DD_HHMM.sql.gz | docker compose exec -T db psql -U pack24 -v ON_ERROR_STOP=1 pack24
#   5) Rasmlar (kerak bo'lsa):
#      docker run --rm -v pack24_uploads:/dst -v /var/backups/pack24:/in alpine tar xzf /in/uploads-YYYY-MM-DD_HHMM.tar.gz -C /dst
#   6) Migratsiyani ortga qaytarish bo'lsa: GitHub'dagi branch'da o'sha commit'ni `git revert` qilib push qiling,
#      so'ng SKIP_BACKUP=1 ./deploy/deploy.sh; oddiy tiklashda: docker compose start web
#   7) Avtomatik yangilanish satrini qayta yoqing.
