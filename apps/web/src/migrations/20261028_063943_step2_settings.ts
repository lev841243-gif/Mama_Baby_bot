import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" ADD COLUMN "calendar_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."settings" ADD COLUMN "author_news" boolean DEFAULT false;
  ALTER TABLE "payload"."settings" ADD COLUMN "accept_all_skips_optional" boolean DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_calendar_enabled" boolean DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_author_news" boolean DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_accept_all_skips_optional" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" DROP COLUMN "calendar_enabled";
  ALTER TABLE "payload"."settings" DROP COLUMN "author_news";
  ALTER TABLE "payload"."settings" DROP COLUMN "accept_all_skips_optional";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_calendar_enabled";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_author_news";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_accept_all_skips_optional";`)
}
