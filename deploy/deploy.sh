#!/usr/bin/env bash
# Yangilash: git'dan oxirgi kodni olib, qayta build qilib, ishga tushiradi.
# Serverda: /opt/pack24/deploy/deploy.sh   (auto-update.sh va GitHub Actions ham shuni chaqiradi)
# Yangi baza migratsiyasi kelsa, kodni almashtirishdan oldin zaxira nusxa oladi (SKIP_BACKUP=1 bilan o'tkazib yuboriladi).
set -euo pipefail
cd "$(dirname "$0")/.."

# Server qaysi branch'dan o'rnatilgan bo'lsa, o'shani kuzatadi; u GitHub'da yo'q bo'lsa (PR qo'shilgach) main
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1 || BRANCH=main

git fetch -q origin "$BRANCH"

# Migratsiyani yangi konteyner ishga tushganda entrypoint.sh qo'llaydi (prisma migrate deploy), shuning uchun
# zaxira kod almashishidan OLDIN olinadi. Oxirgi zaxira qaysi migratsiyalar ro'yxati bilan olingani MIG_STATE
# faylida turadi (git'ga kirmaydi): ro'yxat o'zgarsa — zaxira. Zaxira o'tmasa skript shu yerda to'xtaydi:
# HEAD o'zgarmagan, eski konteyner ishlayveradi, cron 5 daqiqadan keyin qayta urinadi.
MIG_STATE=".deploy-migrations"
MIG_NOW="$(git ls-tree -d --name-only FETCH_HEAD prisma/migrations/)"
if [ "${SKIP_BACKUP:-0}" != "1" ] && [ "$MIG_NOW" != "$(cat "$MIG_STATE" 2>/dev/null || true)" ]; then
  echo "Yangi migratsiya bor — avval zaxira nusxa (deploy/backup.sh)"
  ./deploy/backup.sh
  printf '%s\n' "$MIG_NOW" > "$MIG_STATE"
fi

git checkout -q "$BRANCH"
git pull -q --ff-only origin "$BRANCH"

if [ ! -f docker-compose.yml ]; then
  echo "XATO: '$BRANCH' branch'ida docker-compose.yml yo'q, avvalgi holatga qaytildi"
  git checkout -q -
  exit 1
fi

docker compose build web
docker compose up -d
docker image prune -f >/dev/null

# Sog'lomlik tekshiruvi (90 s gacha kutadi)
for i in $(seq 1 18); do
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "OK: $(git rev-parse --short HEAD) ($BRANCH) ishlamoqda"
    exit 0
  fi
  sleep 5
done
echo "XATO: server javob bermadi, loglar:"
docker compose logs --tail=50 web
exit 1
