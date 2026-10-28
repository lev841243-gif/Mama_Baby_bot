CREATE TYPE "app"."feed_slot" AS ENUM('morning', 'day', 'evening');--> statement-breakpoint
CREATE TABLE "app"."feed_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"slot" "app"."feed_slot" NOT NULL,
	"timezone" text DEFAULT 'Europe/Moscow' NOT NULL,
	"paused_until" timestamp with time zone,
	"resume_warned_at" timestamp with time zone,
	"farewell_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."skill_calendar" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."feed_settings" ADD CONSTRAINT "feed_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;