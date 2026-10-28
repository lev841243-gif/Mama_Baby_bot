import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."materials" ADD COLUMN "import_notes" varchar;
  ALTER TABLE "payload"."_materials_v" ADD COLUMN "version_import_notes" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."materials" DROP COLUMN "import_notes";
  ALTER TABLE "payload"."_materials_v" DROP COLUMN "version_import_notes";`)
}
