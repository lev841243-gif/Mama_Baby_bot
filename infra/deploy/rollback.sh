#!/usr/bin/env bash
# Откат к версии до последнего update.sh: прежний коммит и прежние образы, без пересборки.
# Схему базы не откатывает — при необходимости восстановить дамп из backups/ (см. docs/deploy.md).
# Запуск из корня репозитория: bash infra/deploy/rollback.sh
set -euo pipefail

[ -f backups/.deploy-prev ] || { echo "Нет backups/.deploy-prev — откатывать не к чему"; exit 1; }
for img in migrate web worker; do
  docker image inspect "mama-$img:prev" >/dev/null 2>&1 || { echo "Нет образа mama-$img:prev"; exit 1; }
done

git checkout -q --detach "$(cat backups/.deploy-prev)"
for img in migrate web worker; do
  docker image tag "mama-$img:prev" "mama-$img:latest"
done
docker compose up -d --no-build --force-recreate migrate web worker
docker compose ps
echo "Откат на $(git rev-parse --short HEAD). Следующий update.sh вернёт ветку main."
