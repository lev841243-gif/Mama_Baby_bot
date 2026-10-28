import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."materials" ADD COLUMN "search_text" varchar;
  ALTER TABLE "payload"."_materials_v" ADD COLUMN "version_search_text" varchar;
  CREATE INDEX "materials_search_text_fts_idx" ON "payload"."materials" USING gin (to_tsvector('russian', coalesce("search_text", '')));
  ALTER TABLE "payload"."texts" ADD COLUMN "search_button" varchar DEFAULT 'Поиск';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_title" varchar DEFAULT 'Поиск по материалам';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_placeholder" varchar DEFAULT 'Например: сон, прикорм, ползание';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_go" varchar DEFAULT 'Найти';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_results" varchar DEFAULT 'Нашлось в материалах автора:';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_nothing" varchar DEFAULT 'Такой статьи пока нет.';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_want" varchar DEFAULT 'Хочу материал на эту тему';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_want_pick" varchar DEFAULT 'Какая тема ближе? Автор увидит только тему, без вашего запроса.';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_want_thanks" varchar DEFAULT 'Спасибо! Автор увидит, что эту тему ищут.';
  ALTER TABLE "payload"."texts" ADD COLUMN "search_limit" varchar DEFAULT 'Сегодня вы уже много искали. Попробуйте завтра или загляните в разделы приложения.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_button" varchar DEFAULT 'Поиск';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_title" varchar DEFAULT 'Поиск по материалам';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_placeholder" varchar DEFAULT 'Например: сон, прикорм, ползание';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_go" varchar DEFAULT 'Найти';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_results" varchar DEFAULT 'Нашлось в материалах автора:';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_nothing" varchar DEFAULT 'Такой статьи пока нет.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_want" varchar DEFAULT 'Хочу материал на эту тему';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_want_pick" varchar DEFAULT 'Какая тема ближе? Автор увидит только тему, без вашего запроса.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_want_thanks" varchar DEFAULT 'Спасибо! Автор увидит, что эту тему ищут.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_limit" varchar DEFAULT 'Сегодня вы уже много искали. Попробуйте завтра или загляните в разделы приложения.';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."materials" DROP COLUMN "search_text";
  ALTER TABLE "payload"."_materials_v" DROP COLUMN "version_search_text";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_button";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_title";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_placeholder";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_go";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_results";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_nothing";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_want";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_want_pick";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_want_thanks";
  ALTER TABLE "payload"."texts" DROP COLUMN "search_limit";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_button";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_title";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_placeholder";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_go";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_results";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_nothing";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_want";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_want_pick";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_want_thanks";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_limit";`)
}
