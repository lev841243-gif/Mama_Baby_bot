-- pgvector (образ infra/postgres). В public, чтобы тип vector был виден из любой схемы.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
--> statement-breakpoint
CREATE TABLE "app"."material_vectors" (
	"material_id" integer NOT NULL,
	"part" smallint NOT NULL,
	"model" text NOT NULL,
	"hash" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_vectors_material_id_part_pk" PRIMARY KEY("material_id","part")
);
--> statement-breakpoint
CREATE INDEX "material_vectors_embedding_idx" ON "app"."material_vectors" USING hnsw ("embedding" vector_cosine_ops);