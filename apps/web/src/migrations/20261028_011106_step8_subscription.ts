import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."subscription_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"plan_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"period_days" numeric NOT NULL,
  	"price_rub" numeric NOT NULL,
  	"price_stars" numeric
  );
  
  CREATE TABLE "payload"."subscription" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar DEFAULT 'Закрытые упражнения, статьи и аудиопрактики автора.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."_subscription_v_version_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"plan_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"period_days" numeric NOT NULL,
  	"price_rub" numeric NOT NULL,
  	"price_stars" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_subscription_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_description" varchar DEFAULT 'Закрытые упражнения, статьи и аудиопрактики автора.',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_button" varchar DEFAULT 'Подписка';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_title" varchar DEFAULT 'Подписка';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_plan" varchar DEFAULT 'Подписка на {period} — {price}';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_pay" varchar DEFAULT 'Оплатить';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_offer" varchar DEFAULT 'Нажимая «Оплатить», вы принимаете <a href="{siteUrl}/oferta">условия оферты</a>.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_active" varchar DEFAULT 'Подписка действует до {date}.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_none" varchar DEFAULT 'Подписки пока нет.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_test_mode" varchar DEFAULT 'Тестовый режим: деньги не списываются.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_disabled" varchar DEFAULT 'Оплата пока не подключена.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_paid" varchar DEFAULT 'Подписка оформлена до {date}. Закрытые материалы открыты.';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_reminder" varchar DEFAULT 'Подписка заканчивается {date}. Продлить можно в разделе «Подписка».';
  ALTER TABLE "payload"."texts" ADD COLUMN "subscription_open" varchar DEFAULT 'Оформить подписку';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_button" varchar DEFAULT 'Подписка';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_title" varchar DEFAULT 'Подписка';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_plan" varchar DEFAULT 'Подписка на {period} — {price}';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_pay" varchar DEFAULT 'Оплатить';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_offer" varchar DEFAULT 'Нажимая «Оплатить», вы принимаете <a href="{siteUrl}/oferta">условия оферты</a>.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_active" varchar DEFAULT 'Подписка действует до {date}.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_none" varchar DEFAULT 'Подписки пока нет.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_test_mode" varchar DEFAULT 'Тестовый режим: деньги не списываются.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_disabled" varchar DEFAULT 'Оплата пока не подключена.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_paid" varchar DEFAULT 'Подписка оформлена до {date}. Закрытые материалы открыты.';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_reminder" varchar DEFAULT 'Подписка заканчивается {date}. Продлить можно в разделе «Подписка».';
  ALTER TABLE "payload"."_texts_v" ADD COLUMN "version_subscription_open" varchar DEFAULT 'Оформить подписку';
  ALTER TABLE "payload"."subscription_plans" ADD CONSTRAINT "subscription_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."subscription"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_subscription_v_version_plans" ADD CONSTRAINT "_subscription_v_version_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_subscription_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscription_plans_order_idx" ON "payload"."subscription_plans" USING btree ("_order");
  CREATE INDEX "subscription_plans_parent_id_idx" ON "payload"."subscription_plans" USING btree ("_parent_id");
  CREATE INDEX "_subscription_v_version_plans_order_idx" ON "payload"."_subscription_v_version_plans" USING btree ("_order");
  CREATE INDEX "_subscription_v_version_plans_parent_id_idx" ON "payload"."_subscription_v_version_plans" USING btree ("_parent_id");
  CREATE INDEX "_subscription_v_created_at_idx" ON "payload"."_subscription_v" USING btree ("created_at");
  CREATE INDEX "_subscription_v_updated_at_idx" ON "payload"."_subscription_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."subscription_plans" CASCADE;
  DROP TABLE "payload"."subscription" CASCADE;
  DROP TABLE "payload"."_subscription_v_version_plans" CASCADE;
  DROP TABLE "payload"."_subscription_v" CASCADE;
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_button";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_title";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_plan";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_pay";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_offer";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_active";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_none";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_test_mode";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_disabled";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_paid";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_reminder";
  ALTER TABLE "payload"."texts" DROP COLUMN "subscription_open";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_button";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_title";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_plan";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_pay";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_offer";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_active";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_none";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_test_mode";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_disabled";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_paid";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_reminder";
  ALTER TABLE "payload"."_texts_v" DROP COLUMN "version_subscription_open";`)
}
