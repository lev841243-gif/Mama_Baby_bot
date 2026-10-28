import { eq } from 'drizzle-orm'
import type { Db } from './db/client'
import { feedSettings } from './db/schema'
import { getConsentState, grantOptionalConsent, revokeConsent } from './consents'
import { ageInMonths } from './age'
import { getChildBirth } from './profile'
import { getSettings } from './settings'
import {
  DEFAULT_TIMEZONE,
  FEED_MAX_MONTHS,
  isRuTimezone,
  type FeedPauseDays,
  type FeedSlot,
  type FeedStatePayload,
} from './feed-types'

export * from './feed-types'

export async function getFeedState(db: Db, tgId: number): Promise<FeedStatePayload> {
  const state = await getConsentState(db, tgId)
  const birth = await getChildBirth(db, tgId)
  const { feedPerWeek } = await getSettings(db)
  let settings: FeedStatePayload['settings'] = null
  if (state.userId !== null && state.granted.feed) {
    const [row] = await db.select().from(feedSettings).where(eq(feedSettings.userId, state.userId)).limit(1)
    if (row) {
      const paused = row.pausedUntil && row.pausedUntil > new Date() ? row.pausedUntil.toISOString() : null
      settings = { slot: row.slot, timezone: row.timezone, pausedUntil: paused }
    }
  }
  return { consent: Boolean(state.granted.feed), settings, birth, perWeek: feedPerWeek }
}

export type SubscribeResult = 'ok' | 'need_birth' | 'too_old'

/**
 * Подписка на ленту (ТЗ 7): согласие на рассылку (03-А) + время. Месяц и год рождения спрашиваются до этого
 * (ТЗ 6.3). Старше 18 месяцев лента не предлагается (ТЗ 5); младше 3 — подписка есть, лента начнётся сама.
 */
export async function subscribeFeed(
  db: Db,
  tgId: number,
  opts: { slot: FeedSlot; timezone?: string },
): Promise<SubscribeResult> {
  const birth = await getChildBirth(db, tgId)
  if (!birth) return 'need_birth'
  if (ageInMonths(birth.year, birth.month) >= FEED_MAX_MONTHS) return 'too_old'
  const timezone = opts.timezone && isRuTimezone(opts.timezone) ? opts.timezone : DEFAULT_TIMEZONE
  const userId = await grantOptionalConsent(db, tgId, 'feed')
  await db
    .insert(feedSettings)
    .values({ userId, slot: opts.slot, timezone })
    // Повторная подписка меняет только время; пауза и прощание сбрасываются.
    .onConflictDoUpdate({
      target: feedSettings.userId,
      set: { slot: opts.slot, ...(opts.timezone ? { timezone } : {}), pausedUntil: null, resumeWarnedAt: null },
    })
  return 'ok'
}

async function updateSettings(db: Db, tgId: number, set: Partial<typeof feedSettings.$inferInsert>): Promise<boolean> {
  const state = await getConsentState(db, tgId)
  if (state.userId === null || !state.granted.feed) return false
  const rows = await db.update(feedSettings).set(set).where(eq(feedSettings.userId, state.userId)).returning({ id: feedSettings.userId })
  return rows.length > 0
}

export function setFeedSlot(db: Db, tgId: number, slot: FeedSlot) {
  return updateSettings(db, tgId, { slot })
}

export function setFeedTimezone(db: Db, tgId: number, timezone: string) {
  if (!isRuTimezone(timezone)) return Promise.resolve(false)
  return updateSettings(db, tgId, { timezone })
}

/** Пауза на 1–4 недели: затем лента возобновляется сама, за сутки — предупреждение (ТЗ 7). */
export function pauseFeed(db: Db, tgId: number, days: FeedPauseDays, now = new Date()) {
  return updateSettings(db, tgId, { pausedUntil: new Date(now.getTime() + days * 86_400_000), resumeWarnedAt: null })
}

export function resumeFeed(db: Db, tgId: number) {
  return updateSettings(db, tgId, { pausedUntil: null, resumeWarnedAt: null })
}

/** Отписка = отзыв согласия на ленту: настройки и список отправленного удаляются (ТЗ 8.9, 11.1). */
export function unsubscribeFeed(db: Db, tgId: number) {
  return revokeConsent(db, tgId, 'feed')
}
