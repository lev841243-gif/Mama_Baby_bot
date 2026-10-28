CREATE TYPE "app"."calendar_status" AS ENUM('start', 'formed');--> statement-breakpoint
CREATE TABLE "app"."skill_calendar" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"skill_id" integer NOT NULL,
	"day" date NOT NULL,
	"status" "app"."calendar_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."stat_daily" (
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stat_daily_kind_day_pk" PRIMARY KEY("kind","day")
);
--> statement-breakpoint
ALTER TABLE "app"."skill_calendar" ADD CONSTRAINT "skill_calendar_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_calendar_user_idx" ON "app"."skill_calendar" USING btree ("user_id","skill_id");