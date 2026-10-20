#!/usr/bin/env bash
# Serverdan tashqaridagi zaxira nusxa: baza nusxasini shifrlab, boshqaruv boti orqali administratorlarga Telegram'da fayl qilib yuboradi.
# Server butunlay ishdan chiqsa ham (disk, hosting) oxirgi nusxa Telegram'da qoladi. Ixtiyoriy: deploy/offsite-setup.sh yoqadi
# (.env da BACKUP_PASSPHRASE paydo bo'ladi); yoqilmagan bo'lsa bu skript hech narsa qilmaydi.
# deploy/backup.sh har kunlik zaxiradan keyin chaqiradi. Qo'lda: /opt/pack24/deploy/offsite-send.sh /var/backups/pack24/db-....sql.gz
# Shifr: AES-256 (openssl, PBKDF2). Ochish (istalgan kompyuterda, parol so'raladi):
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in db-SANA.sql.gz.enc -out db-SANA.sql.gz
set -euo pipefail
umask 077
# Nisbiy yo'l skript chaqirilgan papkaga nisbatan olinadi — shuning uchun pastdagi cd dan OLDIN to'liq yo'lga aylantiriladi
FILE="${1:-}"
case "$FILE" in '' | /*) ;; *) FILE="$PWD/$FILE" ;; esac
cd "$(dirname "$0")/.."
STATE="${WATCHDOG_STATE:-/var/lib/pack24/watchdog}"
MAX_BYTES=$((45 * 1024 * 1024)) # Telegram bot orqali fayl 50 MB gacha

# .env qiymati docker compose o'qigandek: oxirgi mos satr; tirnoqli qiymat — tirnoq ichidagisi (ichidagi " #" izoh emas);
# tirnoqsiz qiymat — satr oxiridagi izoh va chetdagi bo'shliqlarsiz; CR olib tashlanadi
env_val() {
  grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed -E "/^[[:space:]]*\"/{ s/^[[:space:]]*\"([^\"]*)\".*$/\1/; b; }; /^[[:space:]]*'/{ s/^[[:space:]]*'([^']*)'.*$/\1/; b; }; s/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//" || true
}
BACKUP_PASS="$(env_val BACKUP_PASSPHRASE)"
[ -n "$BACKUP_PASS" ] || exit 0 # yoqilmagan
export BACKUP_PASS

# Noto'g'ri chaqiruv (nom berilmagan yoki xato) yuborish muammosi emas: belgi o'zgarmaydi, administratorlarga xabar ketmaydi
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "XATO: fayl topilmadi: ${FILE:-nom berilmagan} (masalan: $0 /var/backups/pack24/db-SANA.sql.gz)"; exit 1; }

mkdir -p "$STATE"
chmod 700 "$STATE"
FAILED=""
DONE="" # yuborish oxirigacha yetdi
ENC=""
fail() {
  FAILED=1
  echo "$(date '+%F %T') tashqi nusxa YUBORILMADI: $1"
  date '+%F %T' > "$STATE/offsite.fail"
  exit 1
}
# Kutilmagan xato bilan chiqilsa ham (set -e) belgi "yuborilmadi" bo'ladi; vaqtinchalik fayl har holda o'chiriladi
on_exit() {
  local rc=$?
  [ -z "$ENC" ] || rm -f "$ENC"
  # Chiqish kodiga qaralmaydi: signal bilan to'xtatilganda (o'chirish, kill) tuzoq $? = 0 ni ko'radi
  if [ -z "$DONE" ] && [ -z "$FAILED" ]; then
    echo "$(date '+%F %T') tashqi nusxa YUBORILMADI: yuborish oxirigacha yetmadi (to'xtatilgan yoki kutilmagan xato, kod $rc)"
    date '+%F %T' > "$STATE/offsite.fail"
  fi
}
trap on_exit EXIT

TOKEN="$(env_val STAFF_BOT_TOKEN)"
[ -n "$TOKEN" ] || TOKEN="$(env_val SUPERVISOR_BOT_TOKEN)"
[[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]] || fail "boshqaruv boti tokeni kiritilmagan (deploy/bots-setup.sh)"
[ -s "$STATE/chats" ] || fail "boshqaruv botiga ulangan administrator yo'q (Admin > Xodimlar), yoki kuzatuv hali ishlamagan — 5 daqiqadan keyin qayta urining"

ENC="$(mktemp "${TMPDIR:-/tmp}/pack24-offsite.XXXXXX")" || fail "vaqtinchalik fayl yaratib bo'lmadi"
# Parol muhit o'zgaruvchisidan olinadi (buyruq satriga chiqmaydi)
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$FILE" -out "$ENC" -pass env:BACKUP_PASS 2>/dev/null || fail "shifrlab bo'lmadi"
SIZE="$(stat -c %s "$ENC" 2>/dev/null || echo 0)"
[ "$SIZE" -gt 0 ] || fail "shifrlangan fayl bo'sh"
[ "$SIZE" -le "$MAX_BYTES" ] || fail "nusxa juda katta ($((SIZE / 1024 / 1024)) MB) — Telegram orqali yuborib bo'lmaydi, boshqa saqlash joyi kerak"

NAME="$(basename "$FILE").enc"
SENT=0
while read -r CHAT; do
  [[ "$CHAT" =~ ^-?[0-9]{4,20}$ ]] || continue
  # Token buyruq satriga chiqmaydi: curl sozlamani stdin'dan o'qiydi
  if printf 'url = "https://api.telegram.org/bot%s/sendDocument"\nform = "chat_id=%s"\nform = "document=@%s;filename=%s"\nform = "caption=%s"\n' \
    "$TOKEN" "$CHAT" "$ENC" "$NAME" "Pack24 baza zaxirasi (shifrlangan). Ochish uchun parolingiz kerak." | curl -fsS -m 120 -o /dev/null -K - 2>/dev/null; then
    SENT=$((SENT + 1))
  fi
done < "$STATE/chats"
[ "$SENT" -gt 0 ] || fail "Telegram'ga yuborib bo'lmadi"

rm -f "$STATE/offsite.fail"
date '+%F %T' > "$STATE/offsite.ok"
DONE=1
echo "$(date '+%F %T') tashqi nusxa yuborildi: $NAME ($((SIZE / 1024)) KB, $SENT ta qabul qiluvchi)"
