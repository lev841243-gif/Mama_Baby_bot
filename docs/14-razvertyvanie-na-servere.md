# 14. Деплой на Beget VPS

Сервер — облачный VPS Beget в РФ (решение Льва 28.10.2026, закрывает ТЗ 3.7 и приёмку 6). Обычный shared-хостинг Beget не подходит: нет Docker и постоянных процессов.

Весь стек — один `docker-compose.yml`: postgres, redis, migrate → web, worker, caddy (HTTPS). Наружу открыты только 22/80/443.

## 1. VPS в панели Beget

- Облако → создать сервер: **Ubuntu 24.04**, без готовых приложений.
- **2 vCPU, 4 ГБ RAM, 40+ ГБ NVMe.** Сборке Next.js + Payload нужно 2–4 ГБ; при 2 ГБ скрипт настройки добавит swap 4 ГБ.
- Доступ — SSH-ключ (публичный ключ вставить при создании). Запомнить IP.

## 2. Домен

A-запись домена (или поддомена) → IP сервера. Проверка: `nslookup <домен>` возвращает IP сервера. Без домена Caddy не получит сертификат, а Telegram открывает мини-приложение только по https; временно можно взять `<ip-через-дефисы>.sslip.io`.

## 3. Настройка сервера

```bash
ssh root@<IP>
git clone https://github.com/lev841243-gif/Mama_Baby_bot.git /opt/mama   # или по deploy key, см. ниже
cd /opt/mama
bash infra/deploy/setup-server.sh
```

`setup-server.sh` ставит Docker (если get.docker.com недоступен — пакеты Ubuntu), swap при RAM < 4 ГБ, ufw (22, 80, 443) и в конце проверяет доступ к `api.telegram.org`, Docker Hub, npm и GitHub. Если Docker Hub недоступен — добавить зеркало в `/etc/docker/daemon.json` (`{"registry-mirrors": ["https://mirror.gcr.io"]}`) и `systemctl restart docker`.

**Приватный репозиторий — deploy key** (только чтение):

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_deploy -C mama-server
cat ~/.ssh/github_deploy.pub     # GitHub → репозиторий → Settings → Deploy keys → Add (без write access)
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
git clone git@github.com:lev841243-gif/Mama_Baby_bot.git /opt/mama
```

## 4. `.env` на сервере

```bash
cd /opt/mama
bash infra/deploy/init-env.sh <домен>   # DOMAIN, PUBLIC_URL=https://<домен>, новые секреты, CLOSED_MODE=false
nano .env                               # вписать BOT_TOKEN и ACCESS_LIST_TG_IDS
```

Секреты (`POSTGRES_PASSWORD`, `PAYLOAD_SECRET`, `LOG_HASH_SECRET`) генерируются на сервере `openssl rand -hex 32` и никуда не выводятся. `.env` не коммитится и не копируется с локальной машины. Пароль Postgres задаётся один раз при первом создании тома `pgdata` — потом менять его только вместе с `ALTER USER`.

**На сервере не использовать `compose.dev.yml`** — он для локальной разработки.

## 5. Запуск

Два бота с одним токеном конфликтуют (getUpdates 409). Сначала остановить локальные:

```bash
docker compose stop worker cloudflared     # на локальной машине
```

Потом на сервере:

```bash
cd /opt/mama
docker compose up -d --build
docker compose ps                          # migrate — Exited (0), остальные — Up
docker compose logs --tail 50 web worker caddy
```

Worker при старте сам ставит кнопку меню на `PUBLIC_URL/app`.

## 6. Проверка

- `https://<домен>/app` — валидный сертификат (вне Telegram — «Откройте через бот»).
- `https://<домен>/admin` — вход в Payload (первого пользователя создать здесь же).
- В Telegram: `/start` → приветствие и окно согласий, кнопка меню открывает мини-приложение.
- Снаружи закрыты postgres и redis: `nc -zv <IP> 5432` и `nc -zv <IP> 6379` с другой машины — отказ.

## 7. Обновление

Сначала `git push` с локальной машины, потом на сервере:

```bash
cd /opt/mama && bash infra/deploy/update.sh
```

Скрипт делает дамп базы в `backups/` (последние 10), помечает текущие образы `:prev`, делает `git pull --ff-only` и `docker compose up -d --build`.

## 8. Откат

```bash
cd /opt/mama && bash infra/deploy/rollback.sh
```

Возвращает прежний коммит и прежние образы без пересборки. Схему базы не откатывает; если новая версия испортила данные — восстановить дамп:

```bash
docker compose stop web worker
gunzip -c backups/pre-update-<время>.sql.gz | docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA payload CASCADE; DROP SCHEMA app CASCADE;" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose up -d
```

## Полезное

```bash
docker compose logs -f worker              # логи бота (ID только хешем)
docker compose restart worker
docker compose exec postgres psql -U mama mama
```

## Текущий сервер

- Beget Cloud, СПб, 2 vCPU / 6 ГБ / 50 ГБ NVMe, Ubuntu 24.04, IP `159.194.245.43`, репозиторий — `/opt/mama`.
- Домен пока временный: `159-194-245-43.sslip.io`. Свой домен: A-запись → IP, затем в `.env` поменять `DOMAIN` и `PUBLIC_URL` и `docker compose up -d` (Caddy выпустит сертификат, worker переставит кнопку меню).
- Вход: `ssh -i ~/.ssh/mama_vps root@159.194.245.43`. Если SSH оборвался при открытом nano, правка остаётся в `.env.save` — перенести нужную строку в `.env` и удалить `.env.save` (в нём секреты).
- Секреты на скриншотах и в чатах не показывать; засвеченный секрет — заменить (`openssl rand -hex 32`). Пароль Postgres после первого запуска меняется только вместе с `ALTER USER`.

## Следующие шаги

- **Файлы:** бакет S3 Beget, ключи в `.env` (`S3_*`). Пока `S3_BUCKET` пуст, медиа лежат в томе `media` на сервере.
- **Эксплуатация** ([15-ekspluatatsiya-bekapy-i-monitoring.md](15-ekspluatatsiya-bekapy-i-monitoring.md)): ежедневный бэкап в S3 Beget (`BACKUP_S3_BUCKET`), GlitchTip и Uptime Kuma (`--profile monitoring`), алерты в Telegram (`ALERT_CHAT_ID`), деплой из GitHub Actions.
- Перед бета-тестом с мамами: закрытый режим и «Идёт тестирование» — в «Настройках проекта» админки, «Удалить данные тестировщиков».
