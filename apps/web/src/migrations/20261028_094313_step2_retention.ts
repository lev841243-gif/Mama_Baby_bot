import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" ADD COLUMN "inactive_warning" varchar DEFAULT 'Вы давно не заходили. Если в ближайшие 2 недели вы не откроете бот или приложение, ваши данные будут удалены, как при отзыве согласия. Чтобы их сохранить, просто откройте приложение.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_inactive_warning" varchar DEFAULT 'Вы давно не заходили. Если в ближайшие 2 недели вы не откроете бот или приложение, ваши данные будут удалены, как при отзыве согласия. Чтобы их сохранить, просто откройте приложение.';
  ALTER TABLE "payload"."settings" ADD COLUMN "inactive_cleanup" boolean DEFAULT false;
  ALTER TABLE "payload"."settings" ADD COLUMN "inactive_months" numeric DEFAULT 12;
  ALTER TABLE "payload"."settings" ADD COLUMN "revocation_log" boolean DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_inactive_cleanup" boolean DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_inactive_months" numeric DEFAULT 12;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_revocation_log" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" DROP COLUMN "inactive_warning";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_inactive_warning";
  ALTER TABLE "payload"."settings" DROP COLUMN "inactive_cleanup";
  ALTER TABLE "payload"."settings" DROP COLUMN "inactive_months";
  ALTER TABLE "payload"."settings" DROP COLUMN "revocation_log";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_inactive_cleanup";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_inactive_months";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_revocation_log";`)
}
