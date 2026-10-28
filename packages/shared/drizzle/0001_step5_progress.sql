CREATE TYPE "app"."stat_kind" AS ENUM('view', 'listen', 'done', 'hard');--> statement-breakpoint
CREATE TABLE "app"."bookmarks" (
	"user_id" bigint NOT NULL,
	"material_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."last_opened" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"material_id" integer NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."material_done" (
	"user_id" bigint NOT NULL,
	"material_id" integer NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."stat_material_daily" (
	"material_id" integer NOT NULL,
	"day" date NOT NULL,
	"kind" "app"."stat_kind" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stat_material_daily_material_id_day_kind_pk" PRIMARY KEY("material_id","day","kind")
);
--> statement-breakpoint
ALTER TABLE "app"."bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."last_opened" ADD CONSTRAINT "last_opened_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_done" ADD CONSTRAINT "material_done_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_material_uq" ON "app"."bookmarks" USING btree ("user_id","material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_done_user_material_uq" ON "app"."material_done" USING btree ("user_id","material_id");