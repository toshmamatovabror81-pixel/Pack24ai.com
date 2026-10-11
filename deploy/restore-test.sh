#!/usr/bin/env bash
# Zaxira nusxani sinash: eng yangi baza nusxasini VAQTINCHALIK bazaga (pack24_restore_test) tiklab ko'radi va
# asosiy jadvallar joyidaligini tekshiradi. Ishlab turgan bazaga (pack24) tegmaydi; sinov bazasi oxirida o'chiriladi.
# deploy/backup.sh har kunlik zaxiradan keyin chaqiradi; natija belgisi deploy/watchdog.sh ga ko'rinadi
# (sinov o'tmasa administratorlarga Telegram xabari boradi). Qo'lda: /opt/pack24/deploy/restore-test.sh [nusxa.sql.gz]
set -euo pipefail
umask 077
# Nisbiy yo'l skript chaqirilgan papkaga nisbatan olinadi — shuning uchun pastdagi cd dan OLDIN to'liq yo'lga aylantiriladi
FILE="${1:-}"
case "$FILE" in '' | /*) ;; *) FILE="$PWD/$FILE" ;; esac
cd "$(dirname "$0")/.."
OUT="${BACKUP_DIR:-/var/backups/pack24}"
STATE="${WATCHDOG_STATE:-/var/lib/pack24/watchdog}"
TESTDB="pack24_restore_test"
mkdir -p "$STATE"
chmod 700 "$STATE"

# Qo'lda berilgan nom xato bo'lsa bu zaxira muammosi emas: belgi (ok/fail) o'zgarmaydi, administratorlarga xabar ketmaydi
if [ -n "$FILE" ] && [ ! -f "$FILE" ]; then
  echo "XATO: fayl topilmadi: $FILE"
  exit 1
fi

FAILED=""
DONE="" # sinov oxirigacha yetdi
fail() {
  FAILED=1
  echo "$(date '+%F %T') tiklash sinovi O'TMADI: $1"
  rm -f "$STATE/restore-test.ok"
  date '+%F %T' > "$STATE/restore-test.fail"
  exit 1
}
if [ -z "$FILE" ]; then
  FILE="$(find "$OUT" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'premigration-*.sql.gz' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
fi
[ -n "$FILE" ] && [ -f "$FILE" ] || fail "zaxira nusxa topilmadi ($OUT)"

# Bir vaqtda faqat bitta sinov: baza nomi bitta — ustma-ust ishga tushgan ikki sinov bir-birining bazasini o'chirardi.
# Qulf EXIT tuzog'idan OLDIN olinadi: qulfni olmagan nusxa boshqasining sinov bazasini o'chira olmaydi.
LOCK="${RESTORE_TEST_LOCK:-/var/lock/pack24-restore-test.lock}"
{ exec 8>"$LOCK"; } 2>/dev/null || fail "qulf faylini ochib bo'lmadi ($LOCK)"
flock -w 900 8 || fail "boshqa tiklash sinovi hali tugamadi"

psql_db() { docker compose exec -T db psql -U pack24 -v ON_ERROR_STOP=1 -q "$@"; }
drop_test() { docker compose exec -T db dropdb -U pack24 --if-exists --force "$TESTDB" >/dev/null 2>&1 || true; }
# Kutilmagan xato bilan chiqilsa ham (set -e) belgi "o'tmadi" bo'ladi — eski "o'tdi" belgisi buzilgan nusxani yashirmasin
on_exit() {
  local rc=$?
  drop_test
  # Chiqish kodiga qaralmaydi: signal bilan to'xtatilganda (o'chirish, kill) tuzoq $? = 0 ni ko'radi
  if [ -z "$DONE" ] && [ -z "$FAILED" ]; then
    echo "$(date '+%F %T') tiklash sinovi O'TMADI: sinov oxirigacha yetmadi (to'xtatilgan yoki kutilmagan xato, kod $rc)"
    rm -f "$STATE/restore-test.ok"
    date '+%F %T' > "$STATE/restore-test.fail"
  fi
}
trap on_exit EXIT

gzip -t "$FILE" 2>/dev/null || fail "fayl buzilgan (gzip): $(basename "$FILE")"
drop_test
docker compose exec -T db createdb -U pack24 "$TESTDB" >/dev/null 2>&1 || fail "sinov bazasini yaratib bo'lmadi"
gunzip -c "$FILE" | psql_db -d "$TESTDB" >/dev/null 2>"$STATE/restore-test.err" || fail "nusxa tiklanmadi: $(tail -n 2 "$STATE/restore-test.err" | tr '\n' ' ')"
rm -f "$STATE/restore-test.err"

# Tiklangan bazada asosiy jadvallar bor va o'qiladi (son sifatida qaytadi). So'rov xatosi skriptni to'xtatmaydi — bo'sh qiymat
# pastdagi tekshiruvda "o'qilmadi" deb ushlanadi (jadval yo'q bo'lsa psql xato qaytaradi)
count() { psql_db -At -d "$TESTDB" -c "$1" 2>/dev/null | tr -d '[:space:]' || true; }
TABLES="$(count "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
MIGRATIONS="$(count 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"
ORDERS="$(count 'SELECT count(*) FROM "Order"')"
PRODUCTS="$(count 'SELECT count(*) FROM "Product"')"
USERS="$(count 'SELECT count(*) FROM "User"')"
for n in "$TABLES" "$MIGRATIONS" "$ORDERS" "$PRODUCTS" "$USERS"; do
  [[ "$n" =~ ^[0-9]+$ ]] || fail "tiklangan bazada asosiy jadvallar o'qilmadi ($(basename "$FILE"))"
done
[ "$TABLES" -ge 20 ] && [ "$MIGRATIONS" -ge 1 ] || fail "tiklangan baza to'liq emas (jadvallar: $TABLES, migratsiyalar: $MIGRATIONS)"

rm -f "$STATE/restore-test.fail"
date '+%F %T' > "$STATE/restore-test.ok"
DONE=1
echo "$(date '+%F %T') tiklash sinovi o'tdi: $(basename "$FILE") — $TABLES jadval, $ORDERS buyurtma, $PRODUCTS mahsulot, $USERS foydalanuvchi"
