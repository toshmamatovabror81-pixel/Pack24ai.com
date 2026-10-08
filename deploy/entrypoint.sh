#!/bin/sh
# Konteyner ishga tushganda: migratsiyalar -> (bo'sh bo'lsa) katalog seed -> server
set -e
cd "$(dirname "$0")/.."

echo "[pack24] migratsiyalar..."
node cli/node_modules/prisma/build/index.js migrate deploy

echo "[pack24] katalog tekshiruvi..."
node deploy/seed-if-empty.mjs

echo "[pack24] server :$PORT"
exec node server.js
