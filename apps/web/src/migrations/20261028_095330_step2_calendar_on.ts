import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" ALTER COLUMN "calendar_enabled" SET DEFAULT true;
  ALTER TABLE "payload"."_settings_v" ALTER COLUMN "version_calendar_enabled" SET DEFAULT true;`)
  // Лев 28.10.2026: календарь и голос включены на время разработки. Уже сохранённые «Настройки проекта»
  // иначе вернули бы false при следующем сохранении.
  await db.execute(sql`UPDATE "payload"."settings" SET "calendar_enabled" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" ALTER COLUMN "calendar_enabled" SET DEFAULT false;
  ALTER TABLE "payload"."_settings_v" ALTER COLUMN "version_calendar_enabled" SET DEFAULT false;`)
}
