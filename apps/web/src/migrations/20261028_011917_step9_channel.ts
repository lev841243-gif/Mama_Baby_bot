import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_channel_posts_status" AS ENUM('inbox', 'blocks', 'used', 'skipped');
  CREATE TYPE "payload"."enum_channel_posts_source" AS ENUM('import', 'live');
  CREATE TABLE "payload"."channel_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_id" numeric NOT NULL,
  	"url" varchar,
  	"date" timestamp(3) with time zone,
  	"status" "payload"."enum_channel_posts_status" NOT NULL,
  	"skip_reason" varchar,
  	"source" "payload"."enum_channel_posts_source",
  	"preview" varchar,
  	"text" varchar,
  	"carousel" boolean,
  	"needs_review" boolean,
  	"edited" boolean,
  	"edited_text" varchar,
  	"media_group_id" varchar,
  	"button_material" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."channel_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "payload"."channel_blocks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_id" integer NOT NULL,
  	"order" numeric NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"needs_review" boolean,
  	"used" boolean,
  	"material_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "channel_posts_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "channel_blocks_id" integer;
  ALTER TABLE "payload"."channel_posts_rels" ADD CONSTRAINT "channel_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."channel_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."channel_posts_rels" ADD CONSTRAINT "channel_posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."channel_blocks" ADD CONSTRAINT "channel_blocks_post_id_channel_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "payload"."channel_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."channel_blocks" ADD CONSTRAINT "channel_blocks_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "payload"."materials"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "channel_posts_post_id_idx" ON "payload"."channel_posts" USING btree ("post_id");
  CREATE INDEX "channel_posts_status_idx" ON "payload"."channel_posts" USING btree ("status");
  CREATE INDEX "channel_posts_media_group_id_idx" ON "payload"."channel_posts" USING btree ("media_group_id");
  CREATE INDEX "channel_posts_updated_at_idx" ON "payload"."channel_posts" USING btree ("updated_at");
  CREATE INDEX "channel_posts_created_at_idx" ON "payload"."channel_posts" USING btree ("created_at");
  CREATE INDEX "channel_posts_rels_order_idx" ON "payload"."channel_posts_rels" USING btree ("order");
  CREATE INDEX "channel_posts_rels_parent_idx" ON "payload"."channel_posts_rels" USING btree ("parent_id");
  CREATE INDEX "channel_posts_rels_path_idx" ON "payload"."channel_posts_rels" USING btree ("path");
  CREATE INDEX "channel_posts_rels_media_id_idx" ON "payload"."channel_posts_rels" USING btree ("media_id");
  CREATE INDEX "channel_blocks_post_idx" ON "payload"."channel_blocks" USING btree ("post_id");
  CREATE INDEX "channel_blocks_used_idx" ON "payload"."channel_blocks" USING btree ("used");
  CREATE INDEX "channel_blocks_material_idx" ON "payload"."channel_blocks" USING btree ("material_id");
  CREATE INDEX "channel_blocks_updated_at_idx" ON "payload"."channel_blocks" USING btree ("updated_at");
  CREATE INDEX "channel_blocks_created_at_idx" ON "payload"."channel_blocks" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_channel_posts_fk" FOREIGN KEY ("channel_posts_id") REFERENCES "payload"."channel_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_channel_blocks_fk" FOREIGN KEY ("channel_blocks_id") REFERENCES "payload"."channel_blocks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_channel_posts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("channel_posts_id");
  CREATE INDEX "payload_locked_documents_rels_channel_blocks_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("channel_blocks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."channel_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."channel_posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."channel_blocks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."channel_posts" CASCADE;
  DROP TABLE "payload"."channel_posts_rels" CASCADE;
  DROP TABLE "payload"."channel_blocks" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_channel_posts_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_channel_blocks_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_channel_posts_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_channel_blocks_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "channel_posts_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "channel_blocks_id";
  DROP TYPE "payload"."enum_channel_posts_status";
  DROP TYPE "payload"."enum_channel_posts_source";`)
}
