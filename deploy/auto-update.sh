#!/usr/bin/env bash
# Avtomatik yangilanish (serverda cron har 5 daqiqada): GitHub'dagi branch oldinga ketgan bo'lsa deploy.sh ni chaqiradi.
# Hech qanday kalit yoki parol kerak emas: server o'zi git'dan tortadi (pull-based).
# Branch GitHub'da o'chirilgan bo'lsa (PR main'ga qo'shilgach) main'ga o'tadi.
set -euo pipefail
cd "$(dirname "$0")/.."
LOCK=/var/lock/pack24-deploy.lock
exec 9>"$LOCK"
flock -n 9 || exit 0   # oldingi deploy hali tugamagan

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
