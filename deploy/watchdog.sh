#!/usr/bin/env bash
# Kuzatuv (monitoring). deploy/auto-update.sh har 5 daqiqada chaqiradi — alohida cron satri kerak emas.
# Tekshiradi: sayt ichkaridan (web + baza), sayt internetdan (nginx/Caddy + sertifikat), diskdagi joy, oxirgi zaxira
# nusxa yoshi, zaxirani tiklash sinovi, serverdan tashqaridagi nusxa, HTTPS sertifikat muddati, davriy ishlar signali.
# Muammo paydo bo'lganda boshqaruv boti orqali administratorlarga BIR MARTA xabar beradi (muammo davom etsa har 24 soatda
# bir eslatadi), tuzalganda yana bir marta. Xabar Telegram'ga to'g'ridan-to'g'ri yuboriladi — sayt ishlamay qolganda ham yetib boradi.
# Server faktlarini ilovaga ham yuboradi (/api/ops/heartbeat): Admin > AI tekshiruv sahifasida va kunlik tekshiruvda ko'rinadi.
# Hech narsani o'zgartirmaydi va tuzatmaydi: faqat o'qiydi va xabar beradi. Qo'lda sinash: /opt/pack24/deploy/watchdog.sh -v
set -uo pipefail # -e yo'q: bitta tekshiruvning xatosi qolganlarini to'xtatmasin
cd "$(dirname "$0")/.."
VERBOSE=""
[ "${1:-}" = "-v" ] && VERBOSE=1

STATE="${WATCHDOG_STATE:-/var/lib/pack24/watchdog}"
BACKUPS="${BACKUP_DIR:-/var/backups/pack24}"
mkdir -p "$STATE" 2>/dev/null && chmod 700 "$STATE" 2>/dev/null || { echo "$(date '+%F %T') kuzatuv: $STATE papkasini yaratib bo'lmadi"; exit 0; }
[ -f .env ] || exit 0

# .env qiymati docker compose o'qigandek: oxirgi mos satr; tirnoqli qiymat — tirnoq ichidagisi (ichidagi " #" izoh emas);
# tirnoqsiz qiymat — satr oxiridagi izoh va chetdagi bo'shliqlarsiz; CR olib tashlanadi
env_val() {
  grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed -E "/^[[:space:]]*\"/{ s/^[[:space:]]*\"([^\"]*)\".*$/\1/; b; }; /^[[:space:]]*'/{ s/^[[:space:]]*'([^']*)'.*$/\1/; b; }; s/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//" || true
}
DOMAIN="$(env_val DOMAIN)"
DOMAIN="${DOMAIN:-pack24.uz}"
NOW="$(date +%s)"
log() { echo "$(date '+%F %T') kuzatuv: $*"; }

# ─── Tekshiruvlar ────────────────────────────────────────────────────────────

# 1) Sayt ichkaridan: web konteyneri va baza (/api/health bazaga so'rov yuboradi)
WEB_OK=0
timeout -k 5 25 docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(15000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" </dev/null >/dev/null 2>&1 && WEB_OK=1

# 2) Sayt internetdan: domen -> proksi (nginx yoki Caddy) -> web; sertifikat yaroqsiz bo'lsa ham shu yerda ko'rinadi
SITE_OK=0
curl -fsS -m 20 -o /dev/null "https://$DOMAIN/api/health" 2>/dev/null && SITE_OK=1

# 3) Disk (ildiz bo'lim), band foiz
DISK="$(df -P / 2>/dev/null | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
[[ "$DISK" =~ ^[0-9]+$ ]] || DISK=-1

# 4) Oxirgi kunlik baza nusxasi necha soat oldin olingan (-1: nusxa yo'q)
BACKUP_AGE_H=-1
LAST_BACKUP="$(find "$BACKUPS" -maxdepth 1 -type f -name 'db-*.sql.gz' -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
[[ "$LAST_BACKUP" =~ ^[0-9]+$ ]] && BACKUP_AGE_H=$(( (NOW - LAST_BACKUP) / 3600 ))
# Nusxa vaqti server soatidan oldinda bo'lsa (soat orqaga surilgan) yosh manfiy chiqadi: fayl bor — "nusxa yo'q" (-1) deb o'qilmasin
[[ "$LAST_BACKUP" =~ ^[0-9]+$ ]] && [ "$BACKUP_AGE_H" -lt 0 ] && BACKUP_AGE_H=0

# 5) Zaxirani tiklash sinovi (deploy/restore-test.sh har kunlik zaxiradan keyin yozadi): 1 = o'tgan, 0 = o'tmagan, -1 = hali o'tkazilmagan
RESTORE_OK=-1
[ -e "$STATE/restore-test.ok" ] && RESTORE_OK=1
[ -e "$STATE/restore-test.fail" ] && RESTORE_OK=0

# 5a) Serverdan tashqaridagi nusxa (deploy/offsite-setup.sh yoqadi): -1 = yoqilmagan, 1 = oxirgisi yuborilgan, 0 = yuborilmagan
OFFSITE_OK=-1
if [ -n "$(env_val BACKUP_PASSPHRASE)" ]; then
  OFFSITE_OK=1
  [ -e "$STATE/offsite.fail" ] && OFFSITE_OK=0
fi

# 6) HTTPS sertifikat muddati, kun (-1: aniqlab bo'lmadi; muddati o'tgan bo'lsa 0). 6 soatda bir marta so'raladi
CERT_DAYS=-1
if [ -n "$(find "$STATE/cert-days" -mmin -360 2>/dev/null)" ]; then
  CERT_DAYS="$(cat "$STATE/cert-days" 2>/dev/null)"
else
  CERT_END="$(echo | timeout 15 openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$CERT_END" ] && CERT_END_S="$(date -d "$CERT_END" +%s 2>/dev/null)"; then
    CERT_DAYS=$(( (CERT_END_S - NOW) / 86400 ))
    # Muddati o'tgan sertifikat 0 deb yuboriladi: -1 faqat "aniqlab bo'lmadi" degani, undan kichik sonni ilova rad etadi
    [ "$CERT_DAYS" -lt 0 ] && CERT_DAYS=0
    echo "$CERT_DAYS" > "$STATE/cert-days"
  fi
fi
[[ "$CERT_DAYS" =~ ^[0-9]+$ ]] || CERT_DAYS=-1

# 7) Davriy ishlar signali (auto-update.sh o'tmagan signal uchun shu belgini qo'yadi)
TICK_OK=1
[ -e /var/lock/pack24-tick.failed ] && TICK_OK=0

[ -n "$VERBOSE" ] && log "web=$WEB_OK site=$SITE_OK disk=${DISK}% zaxira=${BACKUP_AGE_H}soat tiklash=$RESTORE_OK tashqi_nusxa=$OFFSITE_OK sertifikat=${CERT_DAYS}kun tick=$TICK_OK"

# ─── Ilovaga faktlar; javobda — xabar oladigan administratorlarning Telegram ID lari ─────────────────────────────
# Maxfiy kalit konteynerning o'z muhitida (env_file) — buyruq satriga chiqmaydi. Faktlar faqat sonlar.
if [ "$WEB_OK" = 1 ]; then
  FACTS="$(printf '{"disk":%s,"backupAgeH":%s,"restoreOk":%s,"offsiteOk":%s,"certDays":%s,"siteOk":%s,"tickOk":%s}' "$DISK" "$BACKUP_AGE_H" "$RESTORE_OK" "$OFFSITE_OK" "$CERT_DAYS" "$SITE_OK" "$TICK_OK")"
  # Ilova javob bergan bo'lsa birinchi satr "ok" bo'ladi, keyin ID lar. So'rov o'tmasa hech narsa chiqmaydi
  HB="$(timeout -k 5 25 docker compose exec -T -e FACTS="$FACTS" web node -e "fetch('http://127.0.0.1:3000/api/ops/heartbeat',{method:'POST',headers:{authorization:'Bearer '+process.env.TELEGRAM_OPS_SECRET,'content-type':'application/json'},body:process.env.FACTS,signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.ok===true&&Array.isArray(j.alertChats))console.log('ok\n'+j.alertChats.join('\n'))}).catch(()=>{})" </dev/null 2>/dev/null | tr -d '\r' || true)"
  # Ro'yxat ilova javob bergandagina yangilanadi — bo'sh bo'lsa ham: oxirgi administrator uzilgan yoki o'chirilgan bo'lsa u xabar
  # (va zaxira nusxa) olishda davom etmasin. So'rov o'tmagan bo'lsa avvalgi ro'yxat qoladi.
  if [ "$(printf '%s\n' "$HB" | head -1)" = "ok" ]; then
    { printf '%s\n' "$HB" | grep -E '^-?[0-9]{4,20}$' || true; } > "$STATE/chats.tmp" && mv "$STATE/chats.tmp" "$STATE/chats"
  fi
fi

# ─── Xabar yuborish ──────────────────────────────────────────────────────────

# 0 — kamida bitta qabul qiluvchiga yetib bordi; 1 — Telegram'ga yuborib bo'lmadi (keyin qayta uriniladi); 2 — bot yoki
# qabul qiluvchi yo'q. Token buyruq satriga chiqmaydi (curl sozlamani stdin'dan o'qiydi).
send() {
  local text="$1" token chat sent=1
  token="$(env_val STAFF_BOT_TOKEN)"
  [ -n "$token" ] || token="$(env_val SUPERVISOR_BOT_TOKEN)"
  [[ "$token" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]] || return 2
  [ -s "$STATE/chats" ] || return 2
  # curl sozlamasida qo'shtirnoq ichidagi \ va " maxsus belgilar: qochirilmasa matn kesilib yoki buzilib ketadi
  text="${text//\\/\\\\}"
  text="${text//\"/\\\"}"
  while read -r chat; do
    [[ "$chat" =~ ^-?[0-9]{4,20}$ ]] || continue
    if printf 'url = "https://api.telegram.org/bot%s/sendMessage"\ndata-urlencode = "chat_id=%s"\ndata-urlencode = "text=%s"\n' "$token" "$chat" "$text" | curl -fsS -m 15 -o /dev/null -K - 2>/dev/null; then sent=0; fi
  done < "$STATE/chats"
  return "$sent"
}

# report <kalit> <holat: 1 yaxshi | 0 yomon | boshqa: o'tkazib yuborish> <necha marta ketma-ket yomon bo'lsa> <muammo matni> <tuzalgandagi matn>
# Belgilar: <kalit>.count — ketma-ket yomon natijalar soni; .alerted — xabar yetkazilgan; .logged — xabar yuborib bo'lmagani logga yozilgan
report() {
  local key="$1" ok="$2" need="$3" bad="$4" good="$5" n rc
  if [ "$ok" = 1 ]; then
    if [ -e "$STATE/$key.alerted" ]; then
      send "🟢 $DOMAIN: $good"
      rc=$?
      # Telegram vaqtincha javob bermasa (1) belgi qoladi: "tuzaldi" xabari keyingi tekshiruvda qayta yuboriladi
      if [ "$rc" != 1 ]; then
        log "tuzaldi: $good"
        rm -f "$STATE/$key.alerted"
      fi
    fi
    rm -f "$STATE/$key.count" "$STATE/$key.logged"
    return 0
  fi
  [ "$ok" = 0 ] || return 0
  n="$(cat "$STATE/$key.count" 2>/dev/null || true)"
  [[ "$n" =~ ^[0-9]{1,9}$ ]] || n=0
  n=$((10#$n + 1))
  echo "$n" > "$STATE/$key.count"
  [ "$n" -ge "$need" ] || return 0
  # Xabar berilgan: muammo davom etsa har 24 soatda bir marta eslatiladi
  if [ -e "$STATE/$key.alerted" ] && [ -z "$(find "$STATE/$key.alerted" -mmin +1440 2>/dev/null)" ]; then return 0; fi
  send "🔴 $DOMAIN: $bad"
  rc=$?
  if [ "$rc" = 0 ]; then
    log "xabar berildi: $bad"
    touch "$STATE/$key.alerted"
    rm -f "$STATE/$key.logged"
  elif [ ! -e "$STATE/$key.logged" ]; then
    # Yuborib bo'lmadi: logga bir marta yoziladi (har 5 daqiqada takrorlanmaydi), yuborishga esa har safar qayta uriniladi —
    # bot yoki administrator keyinroq ulansa ham davom etayotgan muammo haqida xabar boradi
    if [ "$rc" = 2 ]; then log "MUAMMO (Telegram xabari yuborilmadi — boshqaruv boti ulanmagan yoki administrator botga ulanmagan): $bad"; else log "MUAMMO (Telegram'ga yuborib bo'lmadi, keyingi tekshiruvda qayta uriniladi): $bad"; fi
    touch "$STATE/$key.logged"
  fi
}

# ─── Xulosa ──────────────────────────────────────────────────────────────────

report web "$WEB_OK" 2 "sayt javob bermayapti (ilova yoki baza ishlamayapti)." "sayt yana ishlayapti."
# Ilova ishlamasa tashqi tekshiruv ham, davriy signal ham o'tmaydi — ular uchun alohida xabar kerak emas
if [ "$WEB_OK" = 1 ]; then
  report site "$SITE_OK" 2 "sayt internetdan ochilmayapti (https://$DOMAIN): proksi, sertifikat yoki tarmoq muammosi." "sayt internetdan yana ochilyapti."
  # Bitta o'tmagan signal (sayt qayta ishga tushayotgan payt) hali muammo emas
  report tick "$TICK_OK" 2 "davriy ishlar signali o'tmayapti: kunlik eslatma va tekshiruv yuborilmaydi (/var/log/pack24-update.log)." "davriy ishlar signali yana o'tyapti."
fi
if [ "$DISK" -ge 0 ]; then
  # 90% dan xabar beriladi, "tuzaldi" esa faqat 85% dan pastda — chegarada (89/90) har o'zgarishda xabar ketmasin
  DISK_STATE=skip
  [ "$DISK" -ge 90 ] && DISK_STATE=0
  [ "$DISK" -lt 85 ] && DISK_STATE=1
  report disk "$DISK_STATE" 1 "serverda joy tugayapti: disk ${DISK}% band." "diskda joy yetarli (${DISK}% band)."
fi
if [ "$BACKUP_AGE_H" -lt 0 ]; then
  report backup 0 1 "zaxira nusxa topilmadi ($BACKUPS)." "zaxira nusxa olinmoqda."
else
  report backup "$([ "$BACKUP_AGE_H" -lt 30 ] && echo 1 || echo 0)" 1 "zaxira nusxa ${BACKUP_AGE_H} soatdan beri olinmagan (har kuni 03:00 da olinishi kerak)." "zaxira nusxa yana olinmoqda."
fi
report restore "$RESTORE_OK" 1 "zaxira nusxani sinov tariqasida tiklab bo'lmadi — nusxa yaroqsiz bo'lishi mumkin (/var/log/pack24-backup.log)." "zaxira nusxa sinovdan o'tdi."
report offsite "$OFFSITE_OK" 1 "zaxira nusxani Telegram'ga yuborib bo'lmadi (/var/log/pack24-backup.log)." "zaxira nusxa Telegram'ga yana yuborilmoqda."
if [ "$CERT_DAYS" -ge 0 ]; then
  if [ "$CERT_DAYS" -eq 0 ]; then CERT_TEXT="HTTPS sertifikat muddati tugagan yoki bugun tugaydi — sayt brauzerda ochilmay qoladi."; else CERT_TEXT="HTTPS sertifikat muddati ${CERT_DAYS} kundan keyin tugaydi va o'zi yangilanmayapti."; fi
  report cert "$([ "$CERT_DAYS" -ge 14 ] && echo 1 || echo 0)" 1 "$CERT_TEXT" "HTTPS sertifikat yangilandi (${CERT_DAYS} kun)."
fi
exit 0
