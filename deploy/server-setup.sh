#!/usr/bin/env bash
# Yangi Ubuntu (22.04 / 24.04) serverni bir marta sozlash: Docker, firewall, repo, .env
# Ishlatish (serverda root yoki sudo bilan):
#   curl -fsSL https://raw.githubusercontent.com/toshmamatovabror81-pixel/pack24ai.com/main/deploy/server-setup.sh | sudo bash
set -euo pipefail

REPO="${REPO:-https://github.com/toshmamatovabror81-pixel/pack24ai.com.git}"
BRANCH="${BRANCH:-main}"
DIR="${DIR:-/opt/pack24}"
DOMAIN="${DOMAIN:-pack24.uz}"

echo "== 1/5 Docker o'rnatilmoqda"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "== 2/5 Firewall (faqat SSH, HTTP, HTTPS ochiq)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

echo "== 3/5 Kod: $DIR ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

echo "== 4/5 .env"
if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  sed \
    -e "s|^DOMAIN=.*|DOMAIN=\"$DOMAIN\"|" \
    -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://$DOMAIN\"|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\"|" \
    -e "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=\"$ADMIN_PASS\"|" \
    .env.example > .env
  chmod 600 .env
  echo
  echo "   Admin panel: https://$DOMAIN/admin  login: admin  parol: $ADMIN_PASS"
  echo "   (parol faqat shu yerda ko'rsatiladi; .env faylida ham bor)"
  echo
else
  echo "   .env allaqachon bor, o'zgartirilmadi"
fi

echo "== 5/5 Ishga tushirish (birinchi build 3-5 daqiqa)"
docker compose up -d --build

echo
echo "Tayyor. Tekshirish: curl -s https://$DOMAIN/api/health"
echo "Loglar: docker compose -f $DIR/docker-compose.yml logs -f web"
