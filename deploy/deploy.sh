#!/usr/bin/env bash
# Yangilash: git'dan oxirgi kodni olib, qayta build qilib, ishga tushiradi.
# Serverda: /opt/pack24/deploy/deploy.sh   (GitHub Actions ham shuni chaqiradi)
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${BRANCH:-main}"

git fetch -q origin "$BRANCH"
git checkout -q "$BRANCH"
git pull -q --ff-only origin "$BRANCH"

docker compose build web
docker compose up -d
docker image prune -f >/dev/null

# Sog'lomlik tekshiruvi (60 s gacha kutadi)
for i in $(seq 1 12); do
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "OK: $(git rev-parse --short HEAD) ishlamoqda"
    exit 0
  fi
  sleep 5
done
echo "XATO: server javob bermadi, loglar:"
docker compose logs --tail=50 web
exit 1
