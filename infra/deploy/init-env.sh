#!/usr/bin/env bash
# Создаёт .env на сервере из .env.example: домен, режим разработки и новые секреты.
# Секреты генерируются на месте и не выводятся. BOT_TOKEN и ACCESS_LIST_TG_IDS вписать потом вручную.
# Запуск из корня репозитория: bash infra/deploy/init-env.sh <домен>
set -euo pipefail

domain=${1:?Укажите домен: bash infra/deploy/init-env.sh app.example.ru}
[ -f .env.example ] || { echo "Запускать из корня репозитория"; exit 1; }
[ ! -e .env ] || { echo ".env уже есть — не перезаписываю"; exit 1; }

umask 077
set_var() { sed -i "s|^$1=.*|$1=$2|" .env; }

cp .env.example .env
pg_password=$(openssl rand -hex 32)
set_var DOMAIN "$domain"
set_var PUBLIC_URL "https://$domain"
set_var POSTGRES_PASSWORD "$pg_password"
set_var PAYLOAD_SECRET "$(openssl rand -hex 32)"
set_var LOG_HASH_SECRET "$(openssl rand -hex 32)"
# На время разработки бот открыт всем, вошедшие — тестировщики (решение Льва 28.10.2026).
set_var CLOSED_MODE false
set_var TESTER_PHASE true
# Подсказка для pnpm dev на хосте сервером не нужна.
sed -i '/^# DATABASE_URL=/d; /^# REDIS_URL=/d' .env

echo ".env создан (права 600). Впишите BOT_TOKEN и ACCESS_LIST_TG_IDS: nano .env"
