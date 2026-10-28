# Эксплуатация: мониторинг, алерты, бэкап, CI

Дополняет [deploy.md](deploy.md) (установка и обновление на Beget VPS). Требования — ТЗ 11.5 и 13.

## Проверка здоровья

`GET /api/health` → `{"ok":true}` или `503` и список упавшего: `db`, `redis`, `worker` (бот пишет отметку «жив» в Redis раз в 30 с). Наружу — только это, без подробностей.

## Алерты в Telegram

В `.env`: `ALERT_CHAT_ID` — ID чата исполнителя (узнать у @userinfobot; можно добавить автора, создав группу). Бот — `ALERT_BOT_TOKEN` или основной `BOT_TOKEN` (тогда сначала нажмите /start в боте).

Что приходит (не чаще раза в 10 минут на один вид ошибки, без данных мам):
- ошибка API приложения (по адресу),
- бот не обработал сообщение,
- не выполнилась задача бота — оплата, «Прислать в чат», напоминание о подписке, кнопка под постом канала,
- не выполнилась сборка статей из канала (очередь `ai`),
- бэкап не сделан или копия не ушла в S3.

Падение сервера целиком ловит Uptime Kuma (ниже) — у него свои уведомления в Telegram.

## GlitchTip и Uptime Kuma

```bash
docker compose exec postgres createdb -U mama glitchtip   # один раз, если база создана до этого шага
docker compose --profile monitoring up -d glitchtip uptime-kuma
```

Интерфейсы открыты только на сервере. С компьютера — SSH-туннель:

```bash
ssh -L 8000:127.0.0.1:8000 -L 3001:127.0.0.1:3001 root@<IP>
```

- **GlitchTip** — http://localhost:8000: зарегистрируйтесь, создайте организацию и проект (Node.js), скопируйте DSN, замените в нём хост на `glitchtip:8000` и запишите в `.env` как `SENTRY_DSN`; перезапустите `web` и `worker`. В `.env` нужен `GLITCHTIP_SECRET_KEY` (`openssl rand -hex 32`). В ошибки не попадают пользователь, заголовки, тело и параметры запроса.
- **Uptime Kuma** — http://localhost:3001: монитор HTTP(s) на `https://<домен>/api/health` раз в минуту, уведомление — Telegram (тот же бот и чат). Второй монитор — `https://<домен>/app`.

## Бэкап

`infra/backup/backup.sh` — дамп всей базы (схемы `payload` и `app`) и медиа, если они на диске; копия в S3 (`BACKUP_S3_BUCKET` + ключи `S3_*`); хранение 30 дней и на сервере, и в S3 (ТЗ 11.5: удалённые данные мам исчезают из копий по мере ротации).

Ежедневно в 03:30 — в `crontab -e` пользователя, который запускает docker:

```
30 3 * * * cd /opt/mama && bash infra/backup/backup.sh >> backups/backup.log 2>&1
```

**Проверка восстановления** (до запуска и раз в месяц): `bash infra/backup/restore-check.sh` — разворачивает последний дамп во временный Postgres, считает таблицы, материалы и пользователей; рабочую базу не трогает. Проверено локально 28.10.2026.

Восстановление в рабочую базу — как откат в [deploy.md](deploy.md), §8, с файлом из `backups/daily/` (или скачанным из S3).

## Логи

Pino в stdout контейнеров; Telegram ID — только хешем, без имён и текстов запросов. Размер ограничен в `docker-compose.yml` (20 МБ × 5 на сервис), срок — 30 дней через logrotate:

```bash
sudo cp infra/logrotate/mama-docker /etc/logrotate.d/mama-docker
```

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`) — на каждый push и PR: Postgres и Redis, миграции по порядку (сначала Payload, потом drizzle-kit), `typecheck`, тесты на базе, сборка образов web и worker.
- **Deploy** (`.github/workflows/deploy.yml`) — только вручную: Actions → Deploy → Run workflow. По SSH запускает `infra/deploy/update.sh`, затем ждёт `{"ok":true}` от `/api/health`. Секреты репозитория: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, по желанию `DEPLOY_PATH`.
