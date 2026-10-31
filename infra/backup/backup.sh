#!/usr/bin/env bash
# Ежедневный бэкап (ТЗ 13, 11.5): база + медиа в S3-совместимое хранилище в РФ, хранение 30 дней.
# Запуск из корня репозитория: bash infra/backup/backup.sh  (по cron — см. docs/15-ekspluatatsiya-bekapy-i-monitoring.md)
# Нужны в .env: BACKUP_S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (S3_REGION — по желанию).
# При ошибке — алерт в Telegram (ALERT_CHAT_ID).
set -euo pipefail

[ -f .env ] || { echo "Запускать из корня репозитория (нужен .env)"; exit 1; }
set -a; . ./.env; set +a

KEEP_DAYS=30
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="backups/daily"
mkdir -p "$DIR"

alert() {
  local token="${ALERT_BOT_TOKEN:-${BOT_TOKEN:-}}"
  [ -n "${ALERT_CHAT_ID:-}" ] && [ -n "$token" ] || return 0
  curl -s -o /dev/null "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${ALERT_CHAT_ID}" --data-urlencode "text=⚠️ [${DOMAIN:-server}] Бэкап: $1" || true
}
trap 'alert "ошибка на строке $LINENO, бэкап не сделан"' ERR

# 1. База целиком (схемы payload и app) — сжатый дамп.
DB_FILE="$DIR/db-$STAMP.sql.gz"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$DB_FILE"
[ "$(stat -c %s "$DB_FILE")" -gt 1000 ] || { alert "дамп базы подозрительно мал"; exit 1; }

# 2. Медиа, если хранятся на диске (без S3_BUCKET). В S3 медиа и так лежат вне сервера.
MEDIA_FILE=""
if [ -z "${S3_BUCKET:-}" ]; then
  MEDIA_FILE="$DIR/media-$STAMP.tar.gz"
  docker run --rm -v mama_media:/data:ro -v "$PWD/$DIR":/out alpine:3.20 tar czf "/out/media-$STAMP.tar.gz" -C /data .
fi

# 3. Локально храним 30 дней.
find "$DIR" -name '*.gz' -mtime +"$KEEP_DAYS" -delete

# 4. Копия в S3 (rclone без конфиг-файла, всё из env), там тоже 30 дней.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  RCLONE=(docker run --rm -v "$PWD/$DIR":/backup:ro
    -e RCLONE_CONFIG_S3_TYPE=s3 -e RCLONE_CONFIG_S3_PROVIDER=Other
    -e RCLONE_CONFIG_S3_ENDPOINT="$S3_ENDPOINT" -e RCLONE_CONFIG_S3_REGION="${S3_REGION:-ru-1}"
    -e RCLONE_CONFIG_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
    rclone/rclone:1.75.2)
  "${RCLONE[@]}" copy /backup "s3:${BACKUP_S3_BUCKET}/backups" --include "*-$STAMP.*"
  "${RCLONE[@]}" delete "s3:${BACKUP_S3_BUCKET}/backups" --min-age "${KEEP_DAYS}d"
else
  alert "BACKUP_S3_BUCKET не задан — копия только на этом сервере"
fi

echo "Бэкап готов: $DB_FILE ${MEDIA_FILE}"
