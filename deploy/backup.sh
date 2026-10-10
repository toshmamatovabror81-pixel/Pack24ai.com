#!/usr/bin/env bash
# Kunlik zaxira: baza (pg_dump) + yuklangan rasmlar. 14 kunlik nusxalar saqlanadi.
# Cron (har kuni 03:00):  0 3 * * * /opt/pack24/deploy/backup.sh >> /var/log/pack24-backup.log 2>&1
# deploy.sh ham yangi baza migratsiyasi kelganda, uni qo'llashdan oldin shu skriptni chaqiradi.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${BACKUP_DIR:-/var/backups/pack24}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$OUT"

docker compose exec -T db pg_dump -U pack24 --no-owner pack24 | gzip > "$OUT/db-$STAMP.sql.gz"
docker run --rm -v pack24_uploads:/src:ro -v "$OUT":/out alpine tar czf "/out/uploads-$STAMP.tar.gz" -C /src .

find "$OUT" -type f -mtime +14 -delete
echo "$STAMP: $(du -sh "$OUT" | cut -f1) jami"

# Tiklash:
#   gunzip -c db-YYYY-MM-DD_HHMM.sql.gz | docker compose exec -T db psql -U pack24 pack24
#   docker run --rm -v pack24_uploads:/dst -v /var/backups/pack24:/in alpine tar xzf /in/uploads-YYYY-MM-DD_HHMM.tar.gz -C /dst
