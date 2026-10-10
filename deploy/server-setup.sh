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

# Rejim: 80/443 portlar bo'sh bo'lsa Caddy (o'zi HTTPS oladi); boshqa sayt (nginx) egallagan bo'lsa
# PROXY=nginx — Caddy ishlamaydi, sayt 127.0.0.1:WEB_PORT da tinglaydi, mavjud nginx yo'naltiradi.
# Qo'lda tanlash: PROXY=caddy yoki PROXY=nginx
PROXY="${PROXY:-auto}"
if [ "$PROXY" = "auto" ]; then
  PROXY=caddy
  if ss -ltnH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -q . \
     && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^pack24-caddy'; then
    PROXY=nginx
  fi
fi
echo "   Rejim: $PROXY"

if [ "$PROXY" = "caddy" ]; then
  echo "== 3/6 Firewall (faqat SSH, HTTP, HTTPS ochiq)"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
else
  echo "== 3/6 Firewall: serverda boshqa sayt bor, firewall sozlamalariga tegilmadi"
fi

echo "== 4/6 Kod: $DIR ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  # Mavjud o'rnatma ustidan qayta ishga tushirilganda 6-qadam yangi migratsiyani qo'llashi mumkin:
  # deploy.sh dagi kabi avval zaxira nusxa (baza konteyneri ishlab turgan bo'lsa)
  if [ "${SKIP_BACKUP:-0}" != "1" ] && [ -n "$(cd "$DIR" && docker compose ps -q db 2>/dev/null)" ]; then
    BACKUP_PREFIX=premigration bash "$DIR/deploy/backup.sh"
    git -C "$DIR" ls-tree -d --name-only FETCH_HEAD prisma/migrations/ > "$DIR/.deploy-migrations"
  fi
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
    -e "s|^TELEGRAM_WEBHOOK_SECRET=.*|TELEGRAM_WEBHOOK_SECRET=\"$(openssl rand -hex 24)\"|" \
    -e "s|^TELEGRAM_OPS_SECRET=.*|TELEGRAM_OPS_SECRET=\"$(openssl rand -hex 24)\"|" \
    .env.example > .env
  chmod 600 .env
else
  ADMIN_PASS=""
  echo "   .env allaqachon bor, o'zgartirilmadi"
fi
chmod +x deploy/*.sh

if [ "$PROXY" = "nginx" ]; then
  # Bo'sh lokal port (3010 dan boshlab); .env dagi WEB_PORT bo'lsa o'sha qoladi
  WEB_PORT="$(grep -E '^WEB_PORT=' .env | cut -d= -f2 | tr -d '"' || true)"
  if [ -z "$WEB_PORT" ]; then
    WEB_PORT=3010
    while ss -ltnH "( sport = :$WEB_PORT )" | grep -q .; do WEB_PORT=$((WEB_PORT + 1)); done
    printf '\n# Mavjud nginx rejimi: sayt 127.0.0.1:%s da tinglaydi\nWEB_PORT=%s\n' "$WEB_PORT" "$WEB_PORT" >> .env
  fi
  cp deploy/compose.proxy.yml docker-compose.override.yml
  echo "   Caddy o'chirilgan; sayt 127.0.0.1:$WEB_PORT da ishlaydi"
else
  rm -f docker-compose.override.yml
fi
# Har 5 daqiqada GitHub'dan yangilanish, har kuni 03:00 da zaxira nusxa
# (crontab hali yo'q yoki bo'sh bo'lsa crontab -l / grep 1 qaytaradi — bu xato emas)
( { crontab -l 2>/dev/null | grep -v "$DIR/deploy/" || true; } ; \
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

# Mavjud nginx: pack24.uz uchun server bo'limi + certbot (HTTPS). Oldin zaxira nusxa.
NGINX_NOTE=""
if [ -n "$ok" ] && [ "$PROXY" = "nginx" ]; then
  if command -v nginx >/dev/null 2>&1 && [ -d /etc/nginx/sites-enabled ]; then
    echo "== nginx: $DOMAIN bo'limi"
    STAMP="$(date +%Y%m%d-%H%M%S)"
    tar -czf "/root/nginx-backup-$STAMP.tgz" -C / etc/nginx 2>/dev/null && echo "   zaxira: /root/nginx-backup-$STAMP.tgz"
    if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
      sed -e "s|__WEB_PORT__|$WEB_PORT|g" -e "s|pack24\.uz|$DOMAIN|g" deploy/nginx-pack24.conf > "/etc/nginx/sites-available/$DOMAIN"
    fi
    ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx
      echo "   nginx qayta yuklandi (http://$DOMAIN -> 127.0.0.1:$WEB_PORT)"
      if ! command -v certbot >/dev/null 2>&1; then
        apt-get install -y -qq certbot python3-certbot-nginx >/dev/null || true
      fi
      if command -v certbot >/dev/null 2>&1; then
        echo "== HTTPS sertifikat (certbot)"
        if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -n --agree-tos --redirect \
             ${CERTBOT_EMAIL:+-m "$CERTBOT_EMAIL"} ${CERTBOT_EMAIL:---register-unsafely-without-email} >/dev/null 2>&1; then
          echo "   HTTPS tayyor, 80 -> 443 yo'naltirish qo'shildi"
        else
          NGINX_NOTE="HTTPS hali yo'q (DNS tarqalmagan bo'lishi mumkin). Keyinroq: certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect"
        fi
      else
        NGINX_NOTE="certbot o'rnatilmadi. Qo'lda: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect"
      fi
    else
      rm -f "/etc/nginx/sites-enabled/$DOMAIN"
      NGINX_NOTE="nginx -t xato berdi, $DOMAIN bo'limi yoqilmadi (sites-available/$DOMAIN da qoldi). nginx -t natijasini ko'ring."
    fi
  else
    NGINX_NOTE="80/443 ni egallagan server bu mashinadagi nginx emas (ehtimol konteyner). Uni $DOMAIN -> 127.0.0.1:$WEB_PORT ga yo'naltiring (namuna: deploy/nginx-pack24.conf)."
  fi
fi

echo
if [ -n "$ok" ]; then
  echo "================ TAYYOR ================"
  if [ "$PROXY" = "nginx" ]; then
    echo " Sayt ishlamoqda: https://$DOMAIN  (mavjud nginx orqali, port $WEB_PORT)"
    if [ -n "$NGINX_NOTE" ]; then echo " DIQQAT: $NGINX_NOTE"; fi
  else
    echo " Sayt ishlamoqda: https://$DOMAIN  (DNS shu serverga ko'rsatgach ochiladi)"
  fi
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
