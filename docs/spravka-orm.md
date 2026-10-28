# Справка: как устроена работа с базой (ORM)

28.10.2026. Состояние кода после этапа 3, шаг 4.

## Коротко

Одна база — PostgreSQL 16 с pgvector (свой образ, `infra/postgres`). Внутри две схемы, и у каждой свой «хозяин»:

| Схема | Что хранит | Хозяин | Как пишется |
| --- | --- | --- | --- |
| `payload` | Контент автора: материалы, медиа, теги, навыки, тексты, настройки, посты канала, пользователи админки, журнал | **Payload CMS 3** (`@payloadcms/db-postgres` 3.92.1; внутри — тоже Drizzle, но таблицы генерирует Payload) | Только через Payload: админка, Local API в web, внутренние эндпоинты |
| `app` | Данные мам и служебное: пользователи, согласия, подписки, лента, закладки, календарь, обезличенная статистика, настройки для бота, векторы материалов | **Drizzle ORM** 0.45.2 + драйвер `postgres` 3.4.9 (`packages/shared`) | Функции из `@mama/shared` |

Правило: **данные мам не попадают в коллекции Payload**. Автор видит только агрегаты (ТЗ 11.3).

## Подключения

| Процесс | Пулы соединений |
| --- | --- |
| web (Next.js) | Пул Payload (node-postgres) — для админки и контента; пул `getDb()` (postgres-js, до 5 соединений) — для схемы `app` |
| worker (бот, очереди) | Только `getDb()`. Payload в worker не запускается |
| migrate (контейнер) | Сначала `payload migrate`, потом drizzle-миграции |

`getDb()` — один пул на процесс ([client.ts](../packages/shared/src/db/client.ts)). Тип `Db` — экземпляр Drizzle со схемой, поэтому запросы типизированы.

## Схема `app` (Drizzle)

Описание — [schema.ts](../packages/shared/src/db/schema.ts). Таблицы:

- **Мама:** `users` (Telegram ID — `bigint`, месяц и год рождения, `is_tester`, `bot_blocked`), `consents` (каждый пункт окна согласий — отдельная запись с версией), `access_list`.
- **Её действия:** `bookmarks`, `material_done`, `last_opened`, `feed_settings`, `feed_sent` (уникальный индекс `user_id + material_id`), `skill_calendar`.
- **Деньги:** `subscriptions`, `payments`.
- **Обезличенно, без `user_id`:** `stat_material_daily`, `stat_daily`, `stat_wanted_topic`.
- **Служебное:** `app_settings` (ключ → JSON), `material_vectors` (векторы `vector(384)`, индекс HNSW).

Удаление закреплено в самой базе:
- всё, что принадлежит маме, ссылается на `users` с `ON DELETE CASCADE` — отзыв согласия удаляет одну строку `users`, остальное уходит само (ТЗ 6.5, 11.5);
- `payments` — `ON DELETE SET NULL`: запись об оплате остаётся без привязки к человеку;
- статистика и `material_vectors` с мамой не связаны и не удаляются.

Перечисления (`consent_type`, `feed_slot`, `stat_kind`, `calendar_status`) — enum-типы Postgres в схеме `app`.

## Как схемы общаются

**Shared читает контент Payload сырым SQL.** Поиск, лента, календарь, сводка и индекс векторов читают `payload.materials` (и `materials_rels`, `tags`, `skills`, `media`) через `sql`-шаблоны Drizzle. Пример — [search.ts](../packages/shared/src/search.ts). Только чтение, всегда с фильтром `_status = 'published'` и «не в архиве». Так worker работает без Payload.

**Запись в Payload — только через Payload.** Тогда срабатывают хуки, версии, валидация и журнал. Worker пишет в контент через внутренний API web (`/api/internal/*`, секрет `INTERNAL_SECRET`) — например, новые посты канала.

**Payload → бот.** Тексты, «красные слова», версии согласий и настройки: хуки Payload пишут их в `app.app_settings` ([sync.ts](../apps/web/src/payload/hooks/sync.ts)). Бот и приложение читают через `getConfig()` с кешем 30 с ([settings.ts](../packages/shared/src/settings.ts)).

**Векторы.** Worker раз в 2 минуты сверяет `app.material_vectors` с опубликованными материалами ([embed.ts](../packages/shared/src/embed.ts)). Связь по `material_id` без внешнего ключа: схемы мигрируются разными инструментами.

## Миграции

Порядок строгий: **сначала Payload, потом Drizzle**. Так делают контейнер `migrate` и `corepack pnpm db:migrate`.

| | Payload | Drizzle |
| --- | --- | --- |
| Где | `apps/web/src/migrations/*.ts` + снимок `.json` | `packages/shared/drizzle/*.sql` + `meta/` |
| Когда создавать | После правки коллекции или глобала | После правки `schema.ts` |
| Команда | `corepack pnpm -F @mama/web payload migrate:create <имя>` (нужна запущенная база) | `corepack pnpm db:generate` (без базы, сравнивает снимки) |
| Потом | `generate:types` → `payload-types.ts`; новый компонент админки → `generate:importmap` | — |
| Автоприменение схемы | Выключено (`push: false`) | drizzle-kit видит только схему `app` (`schemaFilter`) |

Своё в миграции дописывается руками. Пример — `CREATE EXTENSION vector` в `0007_etap3_material_vectors.sql`. Перед каждым деплоем `update.sh` делает `pg_dump` на диск сервера; откат кода (`rollback.sh`) схему не откатывает.

## Транзакции и повторы

- **Лента:** запись «отправлено» в `feed_sent` и захват дня — в транзакции до отправки. При сбое анонс пропускается, а не дублируется.
- **Оплата:** платёж вставляется с `onConflictDoNothing` по ID платежа у провайдера, и срок продлевается только при новой вставке — повтор не продлевает дважды.
- **Векторы:** удалить старые части и вставить новые — одна транзакция на материал.
- **Счётчики** (статистика, темы «чего ищут») — `insert … on conflict do update set count = count + 1`.

## Типы

- **Drizzle:** типы строк выводятся из `schema.ts`, отдельной генерации нет.
- **Payload:** `apps/web/src/payload-types.ts` генерируется командой `generate:types`. Сырой SQL в shared этими типами не проверяется (см. риски).

## Тесты

`packages/shared/src/db.test.ts` и `apps/worker/src/bot.test.ts` работают на настоящем Postgres (`TEST_DATABASE_URL`, локальная база на порту 55432):
- пишут только отрицательные `tg_id` — таких в Telegram не бывает;
- сложные сценарии идут в транзакции с откатом, поэтому база разработки не засоряется.

Без `TEST_DATABASE_URL` эти тесты пропускаются.

## Риски и на что смотреть

- **Сырой SQL к таблицам Payload.** При переименовании поля коллекции (например, `announce` → `summary`) Payload сменит имя колонки, а запросы в shared сломаются без ошибки компиляции. После правки коллекции «Материалы» — `grep -rn "payload\." packages/shared/src` и прогон тестов.
- **Два пула в web.** При росте нагрузки считать соединения: Payload + 5 shared + 5 worker < `max_connections` (по умолчанию 100).
- **Имена колонок Payload** — snake_case от имени поля (`howMomsAsk` → `how_moms_ask`), у версий — с префиксом `version_` в таблице `_materials_v`.
- **Новая колонка с данными мамы** — это решение заказчицы и новая версия согласия (правило ТЗ 3.5), а не только миграция.
