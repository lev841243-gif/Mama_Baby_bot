import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_materials_type" AS ENUM('exercise', 'article', 'body', 'psy');
  CREATE TYPE "payload"."enum_materials_access" AS ENUM('free', 'paid');
  CREATE TYPE "payload"."enum_materials_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__materials_v_version_type" AS ENUM('exercise', 'article', 'body', 'psy');
  CREATE TYPE "payload"."enum__materials_v_version_access" AS ENUM('free', 'paid');
  CREATE TYPE "payload"."enum__materials_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_useful_links_kind" AS ENUM('consult', 'course', 'book', 'other');
  CREATE TYPE "payload"."enum_playlists_kind" AS ENUM('nursery', 'poems', 'lullabies', 'music');
  CREATE TYPE "payload"."enum_consent_versions_type" AS ENUM('pd', 'feed', 'calendar', 'ads');
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "payload"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TABLE "payload"."materials_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."materials_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"post_id" numeric
  );
  
  CREATE TABLE "payload"."materials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"type" "payload"."enum_materials_type" DEFAULT 'exercise',
  	"cover_id" integer,
  	"body" jsonb,
  	"how_to_know" varchar,
  	"if_not_working" varchar,
  	"easier_variant" varchar,
  	"when_to_see_doctor" varchar,
  	"audio_id" integer,
  	"age_from" numeric,
  	"age_to" numeric,
  	"order" numeric DEFAULT 100,
  	"minutes" numeric,
  	"minutes_manual" boolean DEFAULT false,
  	"announce" varchar,
  	"in_feed" boolean DEFAULT false,
  	"access" "payload"."enum_materials_access" DEFAULT 'free',
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_materials_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."materials_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"skills_id" integer,
  	"materials_id" integer
  );
  
  CREATE TABLE "payload"."_materials_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_materials_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"post_id" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_materials_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_type" "payload"."enum__materials_v_version_type" DEFAULT 'exercise',
  	"version_cover_id" integer,
  	"version_body" jsonb,
  	"version_how_to_know" varchar,
  	"version_if_not_working" varchar,
  	"version_easier_variant" varchar,
  	"version_when_to_see_doctor" varchar,
  	"version_audio_id" integer,
  	"version_age_from" numeric,
  	"version_age_to" numeric,
  	"version_order" numeric DEFAULT 100,
  	"version_minutes" numeric,
  	"version_minutes_manual" boolean DEFAULT false,
  	"version_announce" varchar,
  	"version_in_feed" boolean DEFAULT false,
  	"version_access" "payload"."enum__materials_v_version_access" DEFAULT 'free',
  	"version_archived" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__materials_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."_materials_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"skills_id" integer,
  	"materials_id" integer
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_full_url" varchar,
  	"sizes_full_width" numeric,
  	"sizes_full_height" numeric,
  	"sizes_full_mime_type" varchar,
  	"sizes_full_filesize" numeric,
  	"sizes_full_filename" varchar
  );
  
  CREATE TABLE "payload"."tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"order" numeric DEFAULT 100,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."skills" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"order" numeric DEFAULT 100,
  	"tag_id" integer,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."useful_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"description" varchar,
  	"kind" "payload"."enum_useful_links_kind" DEFAULT 'other',
  	"order" numeric DEFAULT 100,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."playlists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"description" varchar,
  	"kind" "payload"."enum_playlists_kind" DEFAULT 'nursery',
  	"order" numeric DEFAULT 100,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."consent_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "payload"."enum_consent_versions_type" NOT NULL,
  	"version" varchar NOT NULL,
  	"significant" boolean DEFAULT false,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user" varchar NOT NULL,
  	"action" varchar NOT NULL,
  	"target" varchar NOT NULL,
  	"doc_id" varchar,
  	"title" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."totp_attempts" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "payload"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "payload"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "payload"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bot_description" varchar DEFAULT 'Упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев. Спокойно, по шагам, по возрасту малыша.',
  	"bot_short_description" varchar DEFAULT 'Упражнения и практики для мам малышей 3–18 месяцев.',
  	"beta_bot" varchar DEFAULT 'Это бета-версия: бот в разработке и открыт только для тестирования. Что-то может работать не так, материалы ещё дополняются. После окончания тестирования все ваши данные в боте будут удалены.',
  	"beta_banner" varchar DEFAULT 'Бета-версия. Приложение в разработке: что-то может работать не так. После тестирования ваши данные будут удалены.',
  	"beta_consent" varchar DEFAULT 'Идёт тестирование. Тексты согласий — черновики, окончательные появятся перед открытием.',
  	"not_in_access_list" varchar DEFAULT 'Бот пока в разработке. Скоро откроемся — следите за каналом автора: {channelUrl}',
  	"welcome" varchar DEFAULT 'Здравствуйте! Это «Дневник спокойного материнства» — упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев.
  
  Материалы носят информационный характер и не заменяют консультацию врача.
  
  Пользуясь ботом, вы принимаете <a href="{siteUrl}/terms">Пользовательское соглашение</a>.',
  	"start_button" varchar DEFAULT 'Начать',
  	"open_app_button" varchar DEFAULT 'Открыть приложение',
  	"need_consent" varchar DEFAULT 'Чтобы продолжить, откройте приложение и отметьте согласие на обработку данных.',
  	"after_consent" varchar DEFAULT 'Готово! Материалы — в приложении, кнопка «Открыть приложение» рядом с полем ввода.',
  	"open_via_bot" varchar DEFAULT 'Откройте приложение через бот в Telegram.',
  	"main_menu" varchar DEFAULT 'Главное меню. Всё основное — в приложении.',
  	"help_button" varchar DEFAULT 'Помощь',
  	"settings_button" varchar DEFAULT 'Настройки',
  	"back_button" varchar DEFAULT '« Назад',
  	"help" varchar DEFAULT 'Как пользоваться: нажмите «Открыть приложение» — там упражнения и практики по возрасту малыша.
  
  Канал автора: {channelUrl}
  <a href="{siteUrl}/terms">Пользовательское соглашение</a> · <a href="{siteUrl}/privacy">Политика обработки данных</a>',
  	"not_ready_yet" varchar DEFAULT 'Эта часть ещё в разработке. Пока всё — в приложении.',
  	"settings_title" varchar DEFAULT 'Настройки',
  	"settings_age" varchar DEFAULT 'Возраст малыша: {age}.',
  	"settings_age_empty" varchar DEFAULT 'Возраст малыша не указан — он нужен только ленте и подсказке «ваш раздел».',
  	"age_button" varchar DEFAULT 'Возраст малыша',
  	"my_consents_button" varchar DEFAULT 'Мои согласия',
  	"revoke_button" varchar DEFAULT 'Отозвать согласие',
  	"age_ask_year" varchar DEFAULT 'В каком году родился малыш? Точная дата не нужна.',
  	"age_ask_month" varchar DEFAULT 'В каком месяце?',
  	"age_saved" varchar DEFAULT 'Сохранено: {month} {year}.',
  	"age_too_young" varchar DEFAULT 'Основные материалы начинаются с 3 месяцев, а пока вам может помочь «Спокойная мама».',
  	"age_clear_button" varchar DEFAULT 'Удалить дату',
  	"age_cleared" varchar DEFAULT 'Дата рождения удалена.',
  	"app_settings_title" varchar DEFAULT 'Настройки',
  	"consent_title" varchar DEFAULT 'Перед началом',
  	"consent_intro" varchar DEFAULT 'Отметьте, на что вы согласны. Мы храним минимум: ваш Telegram ID и то, что вы сами сохраните в приложении. Имя, телефон и голос не храним.',
  	"consent_accept_all" varchar DEFAULT 'Принять всё',
  	"consent_continue" varchar DEFAULT 'Продолжить с выбранными',
  	"consent_not_now" varchar DEFAULT 'Не сейчас',
  	"consent_not_now_text" varchar DEFAULT 'Без согласия на обработку данных приложение не работает. Вы можете вернуться в любой момент.',
  	"consent_doc_link" varchar DEFAULT 'Текст согласия',
  	"privacy_link" varchar DEFAULT 'Политика обработки данных',
  	"revoke_confirm" varchar DEFAULT 'Все ваши данные, закладки, календарь и подписка на ленту будут удалены без возможности восстановления. Удалить?',
  	"revoke_subscription" varchar DEFAULT 'У вас оплачена подписка до {date}. После удаления доступ к закрытым материалам прекратится. Вернуть деньги за неиспользованный период можно по <a href="{siteUrl}/oferta">условиям оферты</a>.',
  	"revoke_yes" varchar DEFAULT 'Да, удалить',
  	"revoke_no" varchar DEFAULT 'Отмена',
  	"revoke_done" varchar DEFAULT 'Данные удалены. Сообщения в этом чате остались у вас — бот не может их удалить, вы можете очистить чат сами. Если захотите вернуться, нажмите /start.',
  	"revoke_cancelled" varchar DEFAULT 'Хорошо, ничего не удаляем.',
  	"revoke_nothing" varchar DEFAULT 'У нас нет ваших данных. Если захотите начать, нажмите /start.',
  	"consent_revoke_item" varchar DEFAULT 'Отозвать согласие «{title}»?',
  	"consent_revoke_item_pd" varchar DEFAULT 'Все ваши данные будут удалены без возможности восстановления.',
  	"consent_revoke_ok" varchar DEFAULT 'Отозвать',
  	"app_revoke_all" varchar DEFAULT 'Отозвать согласие и удалить данные',
  	"app_deleted_title" varchar DEFAULT 'Данные удалены',
  	"app_deleted" varchar DEFAULT 'Мы удалили все ваши данные. Если захотите вернуться, откройте приложение снова.',
  	"search_soon" varchar DEFAULT 'Поиск по материалам скоро появится. Пока всё — в приложении.',
  	"voice_not_supported" varchar DEFAULT 'Голосовые пока не поддерживаются.',
  	"only_text_and_voice" varchar DEFAULT 'Я понимаю только текст и голос.',
  	"medical_disclaimer" varchar DEFAULT 'Материалы автора. Не заменяет консультацию врача.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."_texts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_bot_description" varchar DEFAULT 'Упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев. Спокойно, по шагам, по возрасту малыша.',
  	"version_bot_short_description" varchar DEFAULT 'Упражнения и практики для мам малышей 3–18 месяцев.',
  	"version_beta_bot" varchar DEFAULT 'Это бета-версия: бот в разработке и открыт только для тестирования. Что-то может работать не так, материалы ещё дополняются. После окончания тестирования все ваши данные в боте будут удалены.',
  	"version_beta_banner" varchar DEFAULT 'Бета-версия. Приложение в разработке: что-то может работать не так. После тестирования ваши данные будут удалены.',
  	"version_beta_consent" varchar DEFAULT 'Идёт тестирование. Тексты согласий — черновики, окончательные появятся перед открытием.',
  	"version_not_in_access_list" varchar DEFAULT 'Бот пока в разработке. Скоро откроемся — следите за каналом автора: {channelUrl}',
  	"version_welcome" varchar DEFAULT 'Здравствуйте! Это «Дневник спокойного материнства» — упражнения и практики Веры Лукиновой для мам малышей от 3 до 18 месяцев.
  
  Материалы носят информационный характер и не заменяют консультацию врача.
  
  Пользуясь ботом, вы принимаете <a href="{siteUrl}/terms">Пользовательское соглашение</a>.',
  	"version_start_button" varchar DEFAULT 'Начать',
  	"version_open_app_button" varchar DEFAULT 'Открыть приложение',
  	"version_need_consent" varchar DEFAULT 'Чтобы продолжить, откройте приложение и отметьте согласие на обработку данных.',
  	"version_after_consent" varchar DEFAULT 'Готово! Материалы — в приложении, кнопка «Открыть приложение» рядом с полем ввода.',
  	"version_open_via_bot" varchar DEFAULT 'Откройте приложение через бот в Telegram.',
  	"version_main_menu" varchar DEFAULT 'Главное меню. Всё основное — в приложении.',
  	"version_help_button" varchar DEFAULT 'Помощь',
  	"version_settings_button" varchar DEFAULT 'Настройки',
  	"version_back_button" varchar DEFAULT '« Назад',
  	"version_help" varchar DEFAULT 'Как пользоваться: нажмите «Открыть приложение» — там упражнения и практики по возрасту малыша.
  
  Канал автора: {channelUrl}
  <a href="{siteUrl}/terms">Пользовательское соглашение</a> · <a href="{siteUrl}/privacy">Политика обработки данных</a>',
  	"version_not_ready_yet" varchar DEFAULT 'Эта часть ещё в разработке. Пока всё — в приложении.',
  	"version_settings_title" varchar DEFAULT 'Настройки',
  	"version_settings_age" varchar DEFAULT 'Возраст малыша: {age}.',
  	"version_settings_age_empty" varchar DEFAULT 'Возраст малыша не указан — он нужен только ленте и подсказке «ваш раздел».',
  	"version_age_button" varchar DEFAULT 'Возраст малыша',
  	"version_my_consents_button" varchar DEFAULT 'Мои согласия',
  	"version_revoke_button" varchar DEFAULT 'Отозвать согласие',
  	"version_age_ask_year" varchar DEFAULT 'В каком году родился малыш? Точная дата не нужна.',
  	"version_age_ask_month" varchar DEFAULT 'В каком месяце?',
  	"version_age_saved" varchar DEFAULT 'Сохранено: {month} {year}.',
  	"version_age_too_young" varchar DEFAULT 'Основные материалы начинаются с 3 месяцев, а пока вам может помочь «Спокойная мама».',
  	"version_age_clear_button" varchar DEFAULT 'Удалить дату',
  	"version_age_cleared" varchar DEFAULT 'Дата рождения удалена.',
  	"version_app_settings_title" varchar DEFAULT 'Настройки',
  	"version_consent_title" varchar DEFAULT 'Перед началом',
  	"version_consent_intro" varchar DEFAULT 'Отметьте, на что вы согласны. Мы храним минимум: ваш Telegram ID и то, что вы сами сохраните в приложении. Имя, телефон и голос не храним.',
  	"version_consent_accept_all" varchar DEFAULT 'Принять всё',
  	"version_consent_continue" varchar DEFAULT 'Продолжить с выбранными',
  	"version_consent_not_now" varchar DEFAULT 'Не сейчас',
  	"version_consent_not_now_text" varchar DEFAULT 'Без согласия на обработку данных приложение не работает. Вы можете вернуться в любой момент.',
  	"version_consent_doc_link" varchar DEFAULT 'Текст согласия',
  	"version_privacy_link" varchar DEFAULT 'Политика обработки данных',
  	"version_revoke_confirm" varchar DEFAULT 'Все ваши данные, закладки, календарь и подписка на ленту будут удалены без возможности восстановления. Удалить?',
  	"version_revoke_subscription" varchar DEFAULT 'У вас оплачена подписка до {date}. После удаления доступ к закрытым материалам прекратится. Вернуть деньги за неиспользованный период можно по <a href="{siteUrl}/oferta">условиям оферты</a>.',
  	"version_revoke_yes" varchar DEFAULT 'Да, удалить',
  	"version_revoke_no" varchar DEFAULT 'Отмена',
  	"version_revoke_done" varchar DEFAULT 'Данные удалены. Сообщения в этом чате остались у вас — бот не может их удалить, вы можете очистить чат сами. Если захотите вернуться, нажмите /start.',
  	"version_revoke_cancelled" varchar DEFAULT 'Хорошо, ничего не удаляем.',
  	"version_revoke_nothing" varchar DEFAULT 'У нас нет ваших данных. Если захотите начать, нажмите /start.',
  	"version_consent_revoke_item" varchar DEFAULT 'Отозвать согласие «{title}»?',
  	"version_consent_revoke_item_pd" varchar DEFAULT 'Все ваши данные будут удалены без возможности восстановления.',
  	"version_consent_revoke_ok" varchar DEFAULT 'Отозвать',
  	"version_app_revoke_all" varchar DEFAULT 'Отозвать согласие и удалить данные',
  	"version_app_deleted_title" varchar DEFAULT 'Данные удалены',
  	"version_app_deleted" varchar DEFAULT 'Мы удалили все ваши данные. Если захотите вернуться, откройте приложение снова.',
  	"version_search_soon" varchar DEFAULT 'Поиск по материалам скоро появится. Пока всё — в приложении.',
  	"version_voice_not_supported" varchar DEFAULT 'Голосовые пока не поддерживаются.',
  	"version_only_text_and_voice" varchar DEFAULT 'Я понимаю только текст и голос.',
  	"version_medical_disclaimer" varchar DEFAULT 'Материалы автора. Не заменяет консультацию врача.',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."red_words_words" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phrase" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."red_words" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"emergency_text" varchar DEFAULT 'Если ребёнку сейчас плохо — звоните <b>103</b> (скорая с мобильного) или <b>112</b>.
  
  Бот не может оценить состояние малыша. При температуре, затруднённом дыхании, судорогах, травме или подозрении на отравление нужна помощь врача.' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."_red_words_v_version_words" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"phrase" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_red_words_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_emergency_text" varchar DEFAULT 'Если ребёнку сейчас плохо — звоните <b>103</b> (скорая с мобильного) или <b>112</b>.
  
  Бот не может оценить состояние малыша. При температуре, затруднённом дыхании, судорогах, травме или подозрении на отравление нужна помощь врача.' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"closed_mode" boolean DEFAULT false,
  	"beta_banner" boolean DEFAULT true,
  	"tester_phase" boolean DEFAULT true,
  	"hide_small_sections" boolean DEFAULT true,
  	"small_section_min" numeric DEFAULT 5,
  	"feed_per_week" numeric DEFAULT 2,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_closed_mode" boolean DEFAULT false,
  	"version_beta_banner" boolean DEFAULT true,
  	"version_tester_phase" boolean DEFAULT true,
  	"version_hide_small_sections" boolean DEFAULT true,
  	"version_small_section_min" numeric DEFAULT 5,
  	"version_feed_per_week" numeric DEFAULT 2,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."users" ADD COLUMN "tg_id" numeric;
  ALTER TABLE "payload"."users" ADD COLUMN "totp_secret" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "materials_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "skills_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "useful_links_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "playlists_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "consent_versions_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "payload"."materials_steps" ADD CONSTRAINT "materials_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."materials_steps" ADD CONSTRAINT "materials_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."materials_sources" ADD CONSTRAINT "materials_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."materials" ADD CONSTRAINT "materials_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."materials" ADD CONSTRAINT "materials_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."materials_rels" ADD CONSTRAINT "materials_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."materials_rels" ADD CONSTRAINT "materials_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."materials_rels" ADD CONSTRAINT "materials_rels_skills_fk" FOREIGN KEY ("skills_id") REFERENCES "payload"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."materials_rels" ADD CONSTRAINT "materials_rels_materials_fk" FOREIGN KEY ("materials_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_version_steps" ADD CONSTRAINT "_materials_v_version_steps_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_version_steps" ADD CONSTRAINT "_materials_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_materials_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_version_sources" ADD CONSTRAINT "_materials_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_materials_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v" ADD CONSTRAINT "_materials_v_parent_id_materials_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."materials"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v" ADD CONSTRAINT "_materials_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v" ADD CONSTRAINT "_materials_v_version_audio_id_media_id_fk" FOREIGN KEY ("version_audio_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_rels" ADD CONSTRAINT "_materials_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_materials_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_rels" ADD CONSTRAINT "_materials_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_rels" ADD CONSTRAINT "_materials_v_rels_skills_fk" FOREIGN KEY ("skills_id") REFERENCES "payload"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_materials_v_rels" ADD CONSTRAINT "_materials_v_rels_materials_fk" FOREIGN KEY ("materials_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."skills" ADD CONSTRAINT "skills_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "payload"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."red_words_words" ADD CONSTRAINT "red_words_words_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."red_words"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_red_words_v_version_words" ADD CONSTRAINT "_red_words_v_version_words_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_red_words_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "materials_steps_order_idx" ON "payload"."materials_steps" USING btree ("_order");
  CREATE INDEX "materials_steps_parent_id_idx" ON "payload"."materials_steps" USING btree ("_parent_id");
  CREATE INDEX "materials_steps_image_idx" ON "payload"."materials_steps" USING btree ("image_id");
  CREATE INDEX "materials_sources_order_idx" ON "payload"."materials_sources" USING btree ("_order");
  CREATE INDEX "materials_sources_parent_id_idx" ON "payload"."materials_sources" USING btree ("_parent_id");
  CREATE INDEX "materials_cover_idx" ON "payload"."materials" USING btree ("cover_id");
  CREATE INDEX "materials_audio_idx" ON "payload"."materials" USING btree ("audio_id");
  CREATE INDEX "materials_archived_idx" ON "payload"."materials" USING btree ("archived");
  CREATE INDEX "materials_updated_at_idx" ON "payload"."materials" USING btree ("updated_at");
  CREATE INDEX "materials_created_at_idx" ON "payload"."materials" USING btree ("created_at");
  CREATE INDEX "materials__status_idx" ON "payload"."materials" USING btree ("_status");
  CREATE INDEX "materials_rels_order_idx" ON "payload"."materials_rels" USING btree ("order");
  CREATE INDEX "materials_rels_parent_idx" ON "payload"."materials_rels" USING btree ("parent_id");
  CREATE INDEX "materials_rels_path_idx" ON "payload"."materials_rels" USING btree ("path");
  CREATE INDEX "materials_rels_tags_id_idx" ON "payload"."materials_rels" USING btree ("tags_id");
  CREATE INDEX "materials_rels_skills_id_idx" ON "payload"."materials_rels" USING btree ("skills_id");
  CREATE INDEX "materials_rels_materials_id_idx" ON "payload"."materials_rels" USING btree ("materials_id");
  CREATE INDEX "_materials_v_version_steps_order_idx" ON "payload"."_materials_v_version_steps" USING btree ("_order");
  CREATE INDEX "_materials_v_version_steps_parent_id_idx" ON "payload"."_materials_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "_materials_v_version_steps_image_idx" ON "payload"."_materials_v_version_steps" USING btree ("image_id");
  CREATE INDEX "_materials_v_version_sources_order_idx" ON "payload"."_materials_v_version_sources" USING btree ("_order");
  CREATE INDEX "_materials_v_version_sources_parent_id_idx" ON "payload"."_materials_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_materials_v_parent_idx" ON "payload"."_materials_v" USING btree ("parent_id");
  CREATE INDEX "_materials_v_version_version_cover_idx" ON "payload"."_materials_v" USING btree ("version_cover_id");
  CREATE INDEX "_materials_v_version_version_audio_idx" ON "payload"."_materials_v" USING btree ("version_audio_id");
  CREATE INDEX "_materials_v_version_version_archived_idx" ON "payload"."_materials_v" USING btree ("version_archived");
  CREATE INDEX "_materials_v_version_version_updated_at_idx" ON "payload"."_materials_v" USING btree ("version_updated_at");
  CREATE INDEX "_materials_v_version_version_created_at_idx" ON "payload"."_materials_v" USING btree ("version_created_at");
  CREATE INDEX "_materials_v_version_version__status_idx" ON "payload"."_materials_v" USING btree ("version__status");
  CREATE INDEX "_materials_v_created_at_idx" ON "payload"."_materials_v" USING btree ("created_at");
  CREATE INDEX "_materials_v_updated_at_idx" ON "payload"."_materials_v" USING btree ("updated_at");
  CREATE INDEX "_materials_v_latest_idx" ON "payload"."_materials_v" USING btree ("latest");
  CREATE INDEX "_materials_v_rels_order_idx" ON "payload"."_materials_v_rels" USING btree ("order");
  CREATE INDEX "_materials_v_rels_parent_idx" ON "payload"."_materials_v_rels" USING btree ("parent_id");
  CREATE INDEX "_materials_v_rels_path_idx" ON "payload"."_materials_v_rels" USING btree ("path");
  CREATE INDEX "_materials_v_rels_tags_id_idx" ON "payload"."_materials_v_rels" USING btree ("tags_id");
  CREATE INDEX "_materials_v_rels_skills_id_idx" ON "payload"."_materials_v_rels" USING btree ("skills_id");
  CREATE INDEX "_materials_v_rels_materials_id_idx" ON "payload"."_materials_v_rels" USING btree ("materials_id");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "payload"."media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "payload"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_full_sizes_full_filename_idx" ON "payload"."media" USING btree ("sizes_full_filename");
  CREATE UNIQUE INDEX "tags_name_idx" ON "payload"."tags" USING btree ("name");
  CREATE INDEX "tags_updated_at_idx" ON "payload"."tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "payload"."tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "skills_name_idx" ON "payload"."skills" USING btree ("name");
  CREATE INDEX "skills_tag_idx" ON "payload"."skills" USING btree ("tag_id");
  CREATE INDEX "skills_updated_at_idx" ON "payload"."skills" USING btree ("updated_at");
  CREATE INDEX "skills_created_at_idx" ON "payload"."skills" USING btree ("created_at");
  CREATE INDEX "useful_links_updated_at_idx" ON "payload"."useful_links" USING btree ("updated_at");
  CREATE INDEX "useful_links_created_at_idx" ON "payload"."useful_links" USING btree ("created_at");
  CREATE INDEX "playlists_updated_at_idx" ON "payload"."playlists" USING btree ("updated_at");
  CREATE INDEX "playlists_created_at_idx" ON "payload"."playlists" USING btree ("created_at");
  CREATE INDEX "consent_versions_updated_at_idx" ON "payload"."consent_versions" USING btree ("updated_at");
  CREATE INDEX "consent_versions_created_at_idx" ON "payload"."consent_versions" USING btree ("created_at");
  CREATE INDEX "audit_log_updated_at_idx" ON "payload"."audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "payload"."audit_log" USING btree ("created_at");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload"."payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload"."payload_jobs" USING btree ("created_at");
  CREATE INDEX "_texts_v_created_at_idx" ON "payload"."_texts_v" USING btree ("created_at");
  CREATE INDEX "_texts_v_updated_at_idx" ON "payload"."_texts_v" USING btree ("updated_at");
  CREATE INDEX "red_words_words_order_idx" ON "payload"."red_words_words" USING btree ("_order");
  CREATE INDEX "red_words_words_parent_id_idx" ON "payload"."red_words_words" USING btree ("_parent_id");
  CREATE INDEX "_red_words_v_version_words_order_idx" ON "payload"."_red_words_v_version_words" USING btree ("_order");
  CREATE INDEX "_red_words_v_version_words_parent_id_idx" ON "payload"."_red_words_v_version_words" USING btree ("_parent_id");
  CREATE INDEX "_red_words_v_created_at_idx" ON "payload"."_red_words_v" USING btree ("created_at");
  CREATE INDEX "_red_words_v_updated_at_idx" ON "payload"."_red_words_v" USING btree ("updated_at");
  CREATE INDEX "_settings_v_created_at_idx" ON "payload"."_settings_v" USING btree ("created_at");
  CREATE INDEX "_settings_v_updated_at_idx" ON "payload"."_settings_v" USING btree ("updated_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_materials_fk" FOREIGN KEY ("materials_id") REFERENCES "payload"."materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_skills_fk" FOREIGN KEY ("skills_id") REFERENCES "payload"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_useful_links_fk" FOREIGN KEY ("useful_links_id") REFERENCES "payload"."useful_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_playlists_fk" FOREIGN KEY ("playlists_id") REFERENCES "payload"."playlists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_versions_fk" FOREIGN KEY ("consent_versions_id") REFERENCES "payload"."consent_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "payload"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_materials_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("materials_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_skills_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("skills_id");
  CREATE INDEX "payload_locked_documents_rels_useful_links_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("useful_links_id");
  CREATE INDEX "payload_locked_documents_rels_playlists_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("playlists_id");
  CREATE INDEX "payload_locked_documents_rels_consent_versions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("consent_versions_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."materials_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."materials_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."materials_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_materials_v_version_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_materials_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_materials_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_materials_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."skills" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."useful_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."playlists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."consent_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."totp_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_texts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."red_words_words" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."red_words" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_red_words_v_version_words" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_red_words_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_settings_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."materials_steps" CASCADE;
  DROP TABLE "payload"."materials_sources" CASCADE;
  DROP TABLE "payload"."materials" CASCADE;
  DROP TABLE "payload"."materials_rels" CASCADE;
  DROP TABLE "payload"."_materials_v_version_steps" CASCADE;
  DROP TABLE "payload"."_materials_v_version_sources" CASCADE;
  DROP TABLE "payload"."_materials_v" CASCADE;
  DROP TABLE "payload"."_materials_v_rels" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."tags" CASCADE;
  DROP TABLE "payload"."skills" CASCADE;
  DROP TABLE "payload"."useful_links" CASCADE;
  DROP TABLE "payload"."playlists" CASCADE;
  DROP TABLE "payload"."consent_versions" CASCADE;
  DROP TABLE "payload"."audit_log" CASCADE;
  DROP TABLE "payload"."totp_attempts" CASCADE;
  DROP TABLE "payload"."payload_jobs_log" CASCADE;
  DROP TABLE "payload"."payload_jobs" CASCADE;
  DROP TABLE "payload"."texts" CASCADE;
  DROP TABLE "payload"."_texts_v" CASCADE;
  DROP TABLE "payload"."red_words_words" CASCADE;
  DROP TABLE "payload"."red_words" CASCADE;
  DROP TABLE "payload"."_red_words_v_version_words" CASCADE;
  DROP TABLE "payload"."_red_words_v" CASCADE;
  DROP TABLE "payload"."settings" CASCADE;
  DROP TABLE "payload"."_settings_v" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_materials_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tags_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_skills_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_useful_links_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_playlists_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_versions_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_materials_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_media_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_tags_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_skills_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_useful_links_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_playlists_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_consent_versions_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "payload"."users" DROP COLUMN "tg_id";
  ALTER TABLE "payload"."users" DROP COLUMN "totp_secret";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "materials_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "tags_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "skills_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "useful_links_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "playlists_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "consent_versions_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  DROP TYPE "payload"."enum_materials_type";
  DROP TYPE "payload"."enum_materials_access";
  DROP TYPE "payload"."enum_materials_status";
  DROP TYPE "payload"."enum__materials_v_version_type";
  DROP TYPE "payload"."enum__materials_v_version_access";
  DROP TYPE "payload"."enum__materials_v_version_status";
  DROP TYPE "payload"."enum_useful_links_kind";
  DROP TYPE "payload"."enum_playlists_kind";
  DROP TYPE "payload"."enum_consent_versions_type";
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  DROP TYPE "payload"."enum_payload_jobs_log_state";
  DROP TYPE "payload"."enum_payload_jobs_task_slug";`)
}
