import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" DROP COLUMN "search_soon";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_search_soon";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."texts" ADD COLUMN "search_soon" varchar;
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_search_soon" varchar;`)
}
