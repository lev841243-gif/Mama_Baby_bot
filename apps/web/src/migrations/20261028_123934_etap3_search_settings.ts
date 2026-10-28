import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" ADD COLUMN "semantic_search" boolean DEFAULT true;
  ALTER TABLE "payload"."settings" ADD COLUMN "search_min_similarity" numeric DEFAULT 0.84;
  ALTER TABLE "payload"."settings" ADD COLUMN "search_per_day" numeric DEFAULT 30;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_semantic_search" boolean DEFAULT true;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_search_min_similarity" numeric DEFAULT 0.84;
  ALTER TABLE "payload"."_settings_v" ADD COLUMN "version_search_per_day" numeric DEFAULT 30;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."settings" DROP COLUMN "semantic_search";
  ALTER TABLE "payload"."settings" DROP COLUMN "search_min_similarity";
  ALTER TABLE "payload"."settings" DROP COLUMN "search_per_day";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_semantic_search";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_search_min_similarity";
  ALTER TABLE "payload"."_settings_v" DROP COLUMN "version_search_per_day";`)
}
