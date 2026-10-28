import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."materials" ADD COLUMN "how_moms_ask" varchar;
  ALTER TABLE "payload"."_materials_v" ADD COLUMN "version_how_moms_ask" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."materials" DROP COLUMN "how_moms_ask";
  ALTER TABLE "payload"."_materials_v" DROP COLUMN "version_how_moms_ask";`)
}
