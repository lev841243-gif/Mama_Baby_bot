// Схема `app` — данные мам (ТЗ 11.1). Payload сюда не пишет, автор видит только агрегаты.
// Правило: всё, что принадлежит маме, ссылается на users с ON DELETE CASCADE,
// кроме payments — запись об оплате остаётся, ссылка обнуляется (ТЗ 11.5).
import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const app = pgSchema('app')

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/** Пункты окна согласий (ТЗ 8.9): основное, лента, календарь (этап 2), новости автора (Р6). */
export const consentType = app.enum('consent_type', ['pd', 'feed', 'calendar', 'ads'])

export const users = app.table('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  // Telegram ID < 2^53, поэтому mode: 'number' безопасен. В логах — только hashTgId().
  tgId: bigint('tg_id', { mode: 'number' }).notNull().unique(),
  // Участник закрытого тестирования: данные удаляются кнопкой в админке (ТЗ 14).
  isTester: boolean('is_tester').notNull().default(false),
  // Только месяц и год, и только когда нужно (ТЗ 6.3).
  childBirthYear: smallint('child_birth_year'),
  childBirthMonth: smallint('child_birth_month'),
  botBlocked: boolean('bot_blocked').notNull().default(false),
  createdAt: createdAt(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Каждое согласие — отдельная запись со своей версией и временем (ТЗ 6.6). */
export const consents = app.table(
  'consents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: consentType('type').notNull(),
    version: text('version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('consents_user_type_idx').on(t.userId, t.type),
    // Не больше одного действующего согласия каждого типа.
    uniqueIndex('consents_active_uq').on(t.userId, t.type).where(sql`${t.revokedAt} is null`),
  ],
)

/** Список доступа закрытого режима (ТЗ 14). Не связан с users: человек может быть в списке до входа. */
export const accessList = app.table('access_list', {
  tgId: bigint('tg_id', { mode: 'number' }).primaryKey(),
  note: text('note'),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Записи об оплате. При удалении мамы остаются, user_id обнуляется (ТЗ 11.5). TODO(Р21): поля под выбранный способ. */
export const payments = app.table('payments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  providerPaymentId: text('provider_payment_id').notNull().unique(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  createdAt: createdAt(),
})

/** Отправленные лентой материалы (этап 2): материал не уходит одной маме дважды (ТЗ 7). */
export const feedSent = app.table(
  'feed_sent',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // id материала из схемы payload; без FK между схемами.
    materialId: integer('material_id').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('feed_sent_user_material_uq').on(t.userId, t.materialId)],
)

/** Переключатели проекта: закрытый режим, плашка беты и т.п. (правятся из админки, шаг 3). */
export const appSettings = app.table('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
