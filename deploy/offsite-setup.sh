#!/usr/bin/env bash
# Serverdan tashqaridagi zaxira nusxani yoqish: har kuni baza nusxasi SHIFRLANIB, boshqaruv boti orqali sizga Telegram'da
# fayl bo'lib keladi. Server butunlay ishdan chiqsa ham ma'lumot yo'qolmaydi.
# Serverda (savol-javob rejimida, shuning uchun ssh -t):
#   ssh -t -i ~/.ssh/KALIT root@SERVER /opt/pack24/deploy/offsite-setup.sh
# Parolni o'zingiz o'ylab topasiz va ESLAB QOLASIZ (yozib qo'ying): faylni faqat shu parol bilan ochish mumkin.
# Parol faqat serverdagi .env ga yoziladi (har kungi shifrlash uchun), ekranda ko'rinmaydi.
# Oldindan kerak: botlar ulangan (deploy/bots-setup.sh) va siz boshqaruv botiga ulangansiz (Admin > Xodimlar).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "XATO: $(pwd)/.env yo'q — avval deploy/server-setup.sh"; exit 1; }
[ -t 0 ] || { echo "XATO: bu skript savol-javob rejimida ishlaydi — ssh -t bilan ishga tushiring"; exit 1; }

current() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' || true; }
set_var() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp .env.XXXXXX)"
  chmod 600 "$tmp"
  grep -v "^$key=" .env > "$tmp" || true
  printf '%s="%s"\n' "$key" "$val" >> "$tmp"
  mv "$tmp" .env
}

echo "== Serverdan tashqaridagi zaxira nusxa (Telegram orqali, shifrlangan)"
echo
if [ -n "$(current BACKUP_PASSPHRASE)" ]; then
  echo "Hozir YOQILGAN. Yangi parol qo'yish uchun uni yozing; o'zgartirmaslik uchun shunchaki Enter;"
  echo "o'chirish uchun bitta chiziqcha (-) yozib Enter bosing."
else
  echo "Parol o'ylab toping (kamida 10 ta belgi: lotin harflari, raqamlar va . _ - belgilari) va Enter bosing."
fi
echo "Parol ekranda ko'rinmaydi — bu normal. Uni albatta yozib qo'ying: parolsiz nusxani ochib bo'lmaydi."
read -rs PASS1 || PASS1=""
echo
if [ "$PASS1" = "-" ]; then
  set_var BACKUP_PASSPHRASE ""
  chmod 600 .env
  echo "== O'chirildi: nusxalar endi Telegram'ga yuborilmaydi (serverdagi kunlik zaxira davom etadi)."
  exit 0
fi
if [ -n "$PASS1" ]; then
  if ! [[ "$PASS1" =~ ^[A-Za-z0-9._-]{10,64}$ ]]; then
    unset PASS1
    echo "XATO: parol kamida 10 ta belgi bo'lsin va faqat lotin harflari, raqamlar, nuqta, chiziqcha va pastki chiziqdan iborat bo'lsin. Hech narsa o'zgartirilmadi."
    exit 1
  fi
  echo "Parolni yana bir marta yozing va Enter bosing:"
  read -rs PASS2 || PASS2=""
  echo
  if [ "$PASS1" != "$PASS2" ]; then
    unset PASS1 PASS2
    echo "XATO: ikki marta yozilgan parol bir xil emas. Hech narsa o'zgartirilmadi — skriptni qayta ishga tushiring."
    exit 1
  fi
  set_var BACKUP_PASSPHRASE "$PASS1"
  chmod 600 .env
  unset PASS1 PASS2
  echo "   saqlandi"
fi
[ -n "$(current BACKUP_PASSPHRASE)" ] || { echo "Parol kiritilmadi — hech narsa o'zgarmadi."; exit 0; }

echo
echo "== Sinov: oxirgi zaxira nusxa hozir yuboriladi"
LATEST="$(find "${BACKUP_DIR:-/var/backups/pack24}" -maxdepth 1 -type f -name 'db-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
if [ -z "$LATEST" ]; then
  echo "Hali kunlik zaxira nusxa yo'q — hozir olinadi"
  BACKUP_SKIP_OFFSITE=1 ./deploy/backup.sh || { echo "XATO: zaxira nusxa olinmadi (yuqoridagi xabarga qarang)."; exit 1; }
  LATEST="$(find "${BACKUP_DIR:-/var/backups/pack24}" -maxdepth 1 -type f -name 'db-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
  [ -n "$LATEST" ] || { echo "XATO: zaxira nusxa topilmadi."; exit 1; }
fi
if ./deploy/offsite-send.sh "$LATEST"; then
  echo "== TAYYOR: Telegram'da boshqaruv botidan fayl keldi — tekshiring. Endi har kuni 03:00 dan keyin yangi nusxa keladi."
  echo "   Faylni ochish (kerak bo'lganda, istalgan kompyuterda; parolingiz so'raladi):"
  echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in db-SANA.sql.gz.enc -out db-SANA.sql.gz"
else
  echo "== Parol saqlandi, lekin sinov yuborilmadi (sababi yuqorida). Sababni tuzatib, skriptni qayta ishga tushiring (parol so'ralganda shunchaki Enter)."
  exit 1
fi
