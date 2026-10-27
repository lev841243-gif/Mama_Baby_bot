#!/usr/bin/env bash
# Первичная настройка VPS (Ubuntu 24.04, под root): Docker, swap, firewall.
# Запуск: bash infra/deploy/setup-server.sh   (повторный запуск безопасен)
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Запускать под root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

apt-get update -q
apt-get install -yq ca-certificates curl git ufw openssl

# Docker: официальный репозиторий, если недоступен — пакеты Ubuntu.
if ! command -v docker >/dev/null; then
  if curl -fsS --max-time 15 https://get.docker.com -o /tmp/get-docker.sh; then
    sh /tmp/get-docker.sh
  else
    apt-get install -yq docker.io docker-compose-v2 docker-buildx
  fi
fi
systemctl enable --now docker
docker compose version

# Swap 4 ГБ, если памяти меньше 4 ГБ и swap нет: сборке Next.js + Payload нужно 2–4 ГБ.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 4000000 ] && [ -z "$(swapon --noheadings)" ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Наружу только SSH и HTTP(S). Postgres и Redis в compose не публикуются.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status verbose

# Доступность внешних сервисов, нужных для сборки и работы бота.
for url in https://api.telegram.org https://registry-1.docker.io/v2/ https://registry.npmjs.org https://github.com; do
  code=$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' "$url" || true)
  echo "$url -> $code"
done
