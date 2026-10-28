#!/usr/bin/env bash
# Проверка восстановления (ТЗ 13: «восстановление проверяется до запуска»).
# Поднимает временный Postgres, разворачивает последний дамп и сверяет число таблиц и материалов.
# Рабочую базу не трогает. Запуск из корня репозитория: bash infra/backup/restore-check.sh [файл.sql.gz]
set -euo pipefail

FILE="${1:-$(ls -1t backups/daily/db-*.sql.gz 2>/dev/null | head -1)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "Нет дампа в backups/daily — сначала bash infra/backup/backup.sh"; exit 1; }

NAME="mama-restore-check-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=check -e POSTGRES_USER=mama -e POSTGRES_DB=mama postgres:16-alpine >/dev/null
until docker exec "$NAME" pg_isready -U mama -d mama >/dev/null 2>&1; do sleep 1; done

gunzip -c "$FILE" | docker exec -i "$NAME" psql -q -U mama -d mama -v ON_ERROR_STOP=1 >/dev/null
q() { docker exec "$NAME" psql -U mama -d mama -tAc "$1"; }
echo "Дамп: $FILE"
echo "Таблиц payload: $(q "select count(*) from information_schema.tables where table_schema='payload'")"
echo "Таблиц app:     $(q "select count(*) from information_schema.tables where table_schema='app'")"
echo "Материалов:     $(q 'select count(*) from payload.materials')"
echo "Пользователей:  $(q 'select count(*) from app.users')"
echo "Восстановление прошло."
