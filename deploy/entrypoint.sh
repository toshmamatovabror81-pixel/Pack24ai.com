#!/bin/sh
# Konteyner ishga tushganda: migratsiyalar -> (bo'sh bo'lsa) katalog seed -> server
set -e
cd "$(dirname "$0")/.."

# Postgres birinchi ishga tushishda bir necha soniya kech tayyor bo'lishi mumkin: 10 marta urinamiz
echo "[pack24] migratsiyalar..."
n=1
until node cli/node_modules/prisma/build/index.js migrate deploy; do
  if [ "$n" -ge 10 ]; then
    echo "[pack24] XATO: migratsiya 10 urinishda ham o'tmadi"
    exit 1
  fi
  echo "[pack24] baza hali tayyor emas, qayta urinish ($n/10)..."
  n=$((n + 1))
  sleep 3
done

echo "[pack24] katalog tekshiruvi..."
node deploy/seed-if-empty.mjs

echo "[pack24] server :$PORT"
exec node server.js
