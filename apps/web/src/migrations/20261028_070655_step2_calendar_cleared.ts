import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" ADD COLUMN "cal_cleared" varchar DEFAULT 'Записи календаря удалены. Остальные данные остались.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_cal_cleared" varchar DEFAULT 'Записи календаря удалены. Остальные данные остались.';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" DROP COLUMN "cal_cleared";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_cal_cleared";`)
}
