CREATE TABLE "app"."subscriptions" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"last_payment_id" text NOT NULL,
	"reminded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."payments" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD COLUMN "period_days" integer;--> statement-breakpoint
ALTER TABLE "app"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_ends_at_idx" ON "app"."subscriptions" USING btree ("ends_at");