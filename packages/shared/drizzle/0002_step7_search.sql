CREATE TABLE "app"."stat_wanted_topic" (
	"topic" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stat_wanted_topic_topic_day_pk" PRIMARY KEY("topic","day")
);
