#!/usr/bin/env bash
# Avtomatik yangilanish (serverda cron har 5 daqiqada): GitHub'dagi branch oldinga ketgan bo'lsa deploy.sh ni chaqiradi.
# Shu bilan birga har ishga tushganda ilovaga davriy ishlar signalini (/api/cron/tick) yuboradi.
# Hech qanday kalit yoki parol kerak emas: server o'zi git'dan tortadi (pull-based).
# Branch GitHub'da o'chirilgan bo'lsa (PR main'ga qo'shilgach) main'ga o'tadi.
set -euo pipefail
cd "$(dirname "$0")/.."
LOCK=/var/lock/pack24-deploy.lock
exec 9>"$LOCK"
flock -n 9 || exit 0   # oldingi deploy hali tugamagan

# Davriy ishlar signali: shu cron satri ilovaning rejalashtiruvchisi ham (alohida cron yoki xizmat kerak emas).
# Har 5 daqiqada POST /api/cron/tick yuboriladi; ilova nima qachon bajarilganini o'zi eslab qoladi (kunlik eslatmalar:
# soat 09:00 dan keyin, kuniga bir marta), shuning uchun takroriy signal zarar qilmaydi. Yangilanish bor-yo'qligidan
# qat'i nazar chaqiriladi va yangilanishni hech qachon to'xtatmaydi (so'rov 60 s da, butun buyruq 90 s da uziladi, TERM'ga
# quloq solmasa yana 10 s dan keyin KILL — aks holda deploy qulfi ushlanib, keyingi yangilanishlar o'tkazib yuborilardi).
# stdin /dev/null dan: `docker compose exec -T` stdin'ni baribir o'qiydi va skript terminaldan qo'lda ishga tushirilganda
# `timeout` ostida (fon guruhida) terminalni o'qishga urinib, 90 s to'xtab qolardi. Tashqi `{ ...; } 2>/dev/null`: KILL
# ishlatilsa bash butun buyruq satrini "Killed ..." deb logga yozmasin — sababi pastda bitta qisqa satr bilan yoziladi.
# Yangilanishdan OLDIN va navbat bilan: deploy konteynerni qayta ishga tushirganda yuborilayotgan eslatma yarmida uzilib qolmasin.
TICK_RC=0
{ timeout -k 10 90 docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/cron/tick',{method:'POST',headers:{authorization:'Bearer '+process.env.TELEGRAM_OPS_SECRET},signal:AbortSignal.timeout(60000)}).then(r=>process.exit(r.ok?0:r.status===401?3:4)).catch(()=>process.exit(1))" </dev/null >/dev/null 2>&1 || TICK_RC=$?; } 2>/dev/null
# Signal o'tmasa logga BITTA qisqa satr yoziladi (aks holda kalit yo'qolsa kunlik eslatmalar izsiz to'xtab qolardi). Belgi fayli
# tufayli har 5 daqiqada takrorlanmaydi: nosozlik boshlanganda va sababi o'zgarganda bir marta (belgida oxirgi kod turadi), signal
# yana o'tgach belgi o'chadi. Bu yerdagi hech bir
# buyruq skriptni to'xtata olmaydi (hammasi `if` sharti yoki `|| true` ostida) — yangilanish baribir davom etadi.
TICK_FAILED=/var/lock/pack24-tick.failed
if [ "$TICK_RC" -eq 0 ]; then
  rm -f "$TICK_FAILED" 2>/dev/null || true
elif [ "$(cat "$TICK_FAILED" 2>/dev/null || true)" != "$TICK_RC" ]; then
  case "$TICK_RC" in
    3) TICK_WHY="401 — .env da TELEGRAM_OPS_SECRET yo'q yoki 16 belgidan qisqa" ;;
    4) TICK_WHY="ilova xato qaytardi (docker compose logs web)" ;;
    124|137) TICK_WHY="90 s ichida tugamadi" ;;
    *) TICK_WHY="web konteyneri javob bermadi (kod $TICK_RC)" ;;
  esac
  echo "$(date '+%F %T') cron tick o'tmadi: $TICK_WHY" || true
  { echo "$TICK_RC" > "$TICK_FAILED"; } 2>/dev/null || true
fi

# Kuzatuv (deploy/watchdog.sh): sayt, disk, zaxira nusxa va sertifikat tekshiriladi; muammo bo'lsa administratorlarga Telegram
# xabari boradi. Yangilanishni hech qachon to'xtatmaydi (150 s da uziladi, xatosi e'tiborga olinmaydi). Yangilanish ketayotgan
# paytda bu skript boshidagi qulf tufayli ishlamaydi — sayt qayta ishga tushayotganda yolg'on "ishlamayapti" xabari chiqmaydi.
if [ -x ./deploy/watchdog.sh ]; then
  { timeout -k 10 150 ./deploy/watchdog.sh </dev/null || true; } 2>/dev/null
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if ! git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "$(date '+%F %T') branch '$BRANCH' GitHub'da yo'q, main'ga o'tilmoqda"
  BRANCH=main
fi

REMOTE="$(git ls-remote --heads origin "$BRANCH" | cut -f1)"
LOCAL="$(git rev-parse HEAD)"
[ -n "$REMOTE" ] && [ "$REMOTE" != "$LOCAL" ] || exit 0

echo "$(date '+%F %T') yangilanish: ${LOCAL:0:7} -> ${REMOTE:0:7} ($BRANCH)"
BRANCH="$BRANCH" ./deploy/deploy.sh
