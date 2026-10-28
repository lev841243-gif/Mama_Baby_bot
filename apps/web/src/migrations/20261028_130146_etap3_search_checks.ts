import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."search_checks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"expect_nothing" boolean DEFAULT false,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."search_checks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"materials_id" integer
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "search_checks_id" integer;
  ALTER TABLE "payload"."search_checks_rels" ADD CONSTRAINT "search_checks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."search_checks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."search_checks_rels" ADD CONSTRAINT "search_checks_rels_materials_fk" FOREIGN KEY ("materials_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "search_checks_updated_at_idx" ON "payload"."search_checks" USING btree ("updated_at");
  CREATE INDEX "search_checks_created_at_idx" ON "payload"."search_checks" USING btree ("created_at");
  CREATE INDEX "search_checks_rels_order_idx" ON "payload"."search_checks_rels" USING btree ("order");
  CREATE INDEX "search_checks_rels_parent_idx" ON "payload"."search_checks_rels" USING btree ("parent_id");
  CREATE INDEX "search_checks_rels_path_idx" ON "payload"."search_checks_rels" USING btree ("path");
  CREATE INDEX "search_checks_rels_materials_id_idx" ON "payload"."search_checks_rels" USING btree ("materials_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_checks_fk" FOREIGN KEY ("search_checks_id") REFERENCES "payload"."search_checks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_search_checks_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("search_checks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."search_checks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."search_checks_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."search_checks" CASCADE;
  DROP TABLE "payload"."search_checks_rels" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_search_checks_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_search_checks_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "search_checks_id";`)
}
