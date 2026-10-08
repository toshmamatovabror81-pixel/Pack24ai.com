#!/usr/bin/env bash
# Yangi Ubuntu (22.04 / 24.04) serverni bir marta sozlash: Docker, firewall, repo, .env, cron
# Ishlatish (serverda root bilan; BRANCH berilmasa main):
#   curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/Pack24ai.com/<branch>/deploy/server-setup.sh | sudo BRANCH=<branch> bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

REPO="${REPO:-https://github.com/toshmamatovabror81-pixel/Pack24ai.com.git}"
BRANCH="${BRANCH:-main}"
DIR="${DIR:-/opt/pack24}"
DOMAIN="${DOMAIN:-pack24.uz}"

echo "== 1/6 Kerakli dasturlar (git, curl, openssl)"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl ufw cron >/dev/null

echo "== 2/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null

echo "== 3/6 Firewall (faqat SSH, HTTP, HTTPS ochiq)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

echo "== 4/6 Kod: $DIR ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

echo "== 5/6 .env va cron"
if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  sed \
    -e "s|^DOMAIN=.*|DOMAIN=\"$DOMAIN\"|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\"|" \
    -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=\"$ADMIN_PASS\"|" \
    .env.example > .env
  chmod 600 .env
else
  ADMIN_PASS=""
  echo "   .env allaqachon bor, o'zgartirilmadi"
fi
chmod +x deploy/*.sh
# Har 5 daqiqada GitHub'dan yangilanish, har kuni 03:00 da zaxira nusxa
( crontab -l 2>/dev/null | grep -v "$DIR/deploy/" ; \
  echo "*/5 * * * * $DIR/deploy/auto-update.sh >> /var/log/pack24-update.log 2>&1" ; \
  echo "0 3 * * * $DIR/deploy/backup.sh >> /var/log/pack24-backup.log 2>&1" ) | crontab -

echo "== 6/6 Ishga tushirish (birinchi build 3-5 daqiqa)"
docker compose up -d --build

echo "   Sayt ishga tushishini kutyapman..."
ok=""
for i in $(seq 1 24); do
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok=1; break
  fi
  sleep 5
done

echo
if [ -n "$ok" ]; then
  echo "================ TAYYOR ================"
  echo " Sayt ishlamoqda: https://$DOMAIN  (DNS shu serverga ko'rsatgach ochiladi)"
  echo " Admin panel:     https://$DOMAIN/admin"
  if [ -n "$ADMIN_PASS" ]; then
    echo " Login: admin    Parol: $ADMIN_PASS"
    echo " (parol faqat shu yerda ko'rsatiladi; $DIR/.env faylida ham bor)"
  fi
  echo "========================================"
else
  echo "XATO: sayt 2 daqiqada ishga tushmadi. Oxirgi loglar:"
  docker compose logs --tail=40 web
  exit 1
fi
