import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from './db/client'
import { consents, feedSent, feedSettings, users } from './db/schema'
import { getConsentState, grantOptionalConsent, isConsentVersionValid, revokeConsent } from './consents'
import { ageInMonths } from './age'
import { getChildBirth } from './profile'
import { getConsentVersions, getSettings } from './settings'
import { getActiveSubscriptionUntil } from './subscription'
import { signedMediaPath } from './media-sign'
import {
  DEFAULT_TIMEZONE,
  FEED_MAX_MONTHS,
  feedDecision,
  isRuTimezone,
  localParts,
  type FeedCandidate,
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

// ---------- Отправка (ТЗ 7, приёмка 26–28) ----------

export type FeedMaterial = { id: number; title: string; announce: string; photoPath: string | null }

/**
 * Следующий материал ленты (ТЗ 7): опубликован, не в архиве, «участвует в ленте», возраст материала включает
 * текущий возраст ребёнка в полных месяцах (Л4), доступен маме (бесплатный или есть подписка), ещё не отправлялся.
 * По полю «порядок». Прошлый возраст не досылается, повторов нет.
 */
export async function nextFeedMaterial(db: Db, userId: number, months: number, hasSubscription: boolean): Promise<FeedMaterial | null> {
  const rows = await db.execute<{
    id: number
    title: string
    announce: string | null
    media_id: number | null
    mime_type: string | null
    card: string | null
  }>(sql`
    select m.id, m.title, m.announce, med.id media_id, med.mime_type, med.sizes_card_filename card
    from payload.materials m
    left join payload.media med on med.id = m.cover_id
    where m._status = 'published'
      and coalesce(m.archived, false) = false
      and m.in_feed = true
      and m.type in ('exercise', 'article')
      and m.age_from <= ${months} and m.age_to > ${months}
      and (m.access = 'free' or ${hasSubscription})
      and not exists (select 1 from app.feed_sent s where s.user_id = ${userId} and s.material_id = m.id)
    order by m."order" asc, m.id asc
    limit 1`)
  const r = rows[0]
  if (!r) return null
  const photo = r.media_id && r.mime_type?.startsWith('image/') ? signedMediaPath(Number(r.media_id), r.card ? 'card' : 'original') : null
  return { id: Number(r.id), title: r.title, announce: r.announce ?? '', photoPath: photo }
}

/** Отправка в Telegram. «blocked» — мама заблокировала бот (403). */
export type FeedSender = {
  announce: (tgId: number, m: FeedMaterial) => Promise<'ok' | 'blocked'>
  text: (tgId: number, kind: 'farewell' | 'resume-warning') => Promise<'ok' | 'blocked'>
}

type Row = FeedCandidate & { userId: number; tgId: number }

/** Подписанные на ленту, кому вообще можно писать: действующие согласия на ленту и основное, бот не заблокирован. */
async function feedCandidates(db: Db): Promise<Row[]> {
  const cf = alias(consents, 'cf')
  const cp = alias(consents, 'cp')
  const rows = await db
    .select({
      userId: users.id,
      tgId: users.tgId,
      birthYear: users.childBirthYear,
      birthMonth: users.childBirthMonth,
      slot: feedSettings.slot,
      timezone: feedSettings.timezone,
      pausedUntil: feedSettings.pausedUntil,
      resumeWarnedAt: feedSettings.resumeWarnedAt,
      farewellAt: feedSettings.farewellAt,
      lastSentAt: feedSettings.lastSentAt,
      feedVersion: cf.version,
      pdVersion: cp.version,
    })
    .from(feedSettings)
    .innerJoin(users, eq(users.id, feedSettings.userId))
    .innerJoin(cf, and(eq(cf.userId, users.id), eq(cf.type, 'feed'), isNull(cf.revokedAt)))
    .innerJoin(cp, and(eq(cp.userId, users.id), eq(cp.type, 'pd'), isNull(cp.revokedAt)))
    .where(and(eq(users.botBlocked, false), isNull(feedSettings.farewellAt)))
  const versions = await getConsentVersions(db)
  // Устаревшая существенная версия согласия — ничего не шлём до повторного согласия (ТЗ 6.6).
  return rows
    .filter((r) => r.birthYear && r.birthMonth)
    .filter((r) => isConsentVersionValid('feed', r.feedVersion, versions) && isConsentVersionValid('pd', r.pdVersion, versions))
    .map((r) => ({ ...r, birthYear: r.birthYear!, birthMonth: r.birthMonth! }))
}

/**
 * Захват анонса на сегодня и запись «отправлено» — в одной транзакции и **до** отправки: после перезапуска
 * материал не уйдёт второй раз (приёмка 26). Сбой отправки — анонс пропущен, но не продублирован.
 */
async function claimAnnounce(db: Db, userId: number, materialId: number, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Не чаще раза в сутки: слот — 2 часа, поэтому 20 часов отделяют «сегодня» от «вчера».
    const claimed = await tx
      .update(feedSettings)
      .set({ lastSentAt: now })
      .where(
        and(
          eq(feedSettings.userId, userId),
          or(isNull(feedSettings.lastSentAt), lt(feedSettings.lastSentAt, new Date(now.getTime() - 20 * 3600_000))),
        ),
      )
      .returning({ id: feedSettings.userId })
    if (claimed.length === 0) return false
    const sent = await tx.insert(feedSent).values({ userId, materialId, sentAt: now }).onConflictDoNothing().returning({ id: feedSent.userId })
    // Материал уже уходил (параллельный проход) — откатываем захват дня.
    if (sent.length === 0) throw new SkipClaim()
    return true
  }).catch((err: unknown) => {
    if (err instanceof SkipClaim) return false
    throw err
  })
}

class SkipClaim extends Error {}

/** Отметка «прощание отправлено» или «предупреждение отправлено» — один раз, захватом до отправки. */
async function claimOnce(db: Db, userId: number, field: 'farewellAt' | 'resumeWarnedAt', now: Date): Promise<boolean> {
  const rows = await db
    .update(feedSettings)
    .set({ [field]: now })
    .where(and(eq(feedSettings.userId, userId), isNull(feedSettings[field])))
    .returning({ id: feedSettings.userId })
  return rows.length > 0
}

export type FeedTickResult = { announces: number; farewells: number; warnings: number; blocked: number; failed: number }

/**
 * Один проход ленты (раз в 15 минут): решения по времени мамы, захват, отправка.
 * `onlyTgIds` — только эти мамы (тесты на общей базе).
 */
export async function runFeedTick(db: Db, send: FeedSender, now = new Date(), onlyTgIds?: number[]): Promise<FeedTickResult> {
  const { feedPerWeek } = await getSettings(db)
  const res: FeedTickResult = { announces: 0, farewells: 0, warnings: 0, blocked: 0, failed: 0 }
  const candidates = (await feedCandidates(db)).filter((c) => !onlyTgIds || onlyTgIds.includes(c.tgId))
  for (const c of candidates) {
    const decision = feedDecision(c, now, feedPerWeek)
    if (decision === 'none') continue
    try {
      let out: 'ok' | 'blocked' | null = null
      if (decision === 'farewell') {
        if (await claimOnce(db, c.userId, 'farewellAt', now)) out = await send.text(c.tgId, 'farewell')
        if (out === 'ok') res.farewells++
      } else if (decision === 'resume-warning') {
        if (await claimOnce(db, c.userId, 'resumeWarnedAt', now)) out = await send.text(c.tgId, 'resume-warning')
        if (out === 'ok') res.warnings++
      } else {
        const local = localParts(now, c.timezone)
        const months = (local.year - c.birthYear) * 12 + (local.month - c.birthMonth)
        // Доступ к закрытому — по подписке в момент отправки (ТЗ 8.6, приёмка 16).
        const sub = await getActiveSubscriptionUntil(db, c.tgId, now)
        const material = await nextFeedMaterial(db, c.userId, months, sub !== null)
        // Материалы возраста закончились — лента молчит до следующего возраста (ТЗ 7).
        if (material && (await claimAnnounce(db, c.userId, material.id, now))) out = await send.announce(c.tgId, material)
        if (out === 'ok') res.announces++
      }
      if (out === 'blocked') res.blocked++
    } catch {
      res.failed++
    }
  }
  return res
}
