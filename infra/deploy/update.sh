#!/usr/bin/env bash
# Обновление на сервере: дамп базы, метка :prev на текущих образах, git pull, пересборка.
# Запуск из корня репозитория: bash infra/deploy/update.sh
set -euo pipefail

[ -f .env ] || { echo "Запускать из корня репозитория (нужен .env)"; exit 1; }
mkdir -p backups

# Дамп перед миграциями: откат кода не откатывает схему базы.
if docker compose ps --status running --services | grep -qx postgres; then
  docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "backups/pre-update-$(date +%Y%m%d-%H%M%S).sql.gz"
  ls -1t backups/pre-update-*.sql.gz | tail -n +11 | xargs -r rm --
fi

# Текущие образы и коммит — для rollback.sh.
for img in migrate web worker; do
  if docker image inspect "mama-$img:latest" >/dev/null 2>&1; then
    docker image tag "mama-$img:latest" "mama-$img:prev"
  fi
done
git rev-parse HEAD > backups/.deploy-prev

git fetch -q origin
git checkout -q main
git pull -q --ff-only origin main
echo "Было: $(cat backups/.deploy-prev | cut -c1-7)  стало: $(git rev-parse --short HEAD)"

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
