// Лента в боте (ТЗ 6.2, 7): подписка, время, часовой пояс, пауза, отписка. Отправка — feed.ts.
import {
  FEED_MAX_MONTHS,
  FEED_MIN_MONTHS,
  FEED_PAUSE_DAYS,
  RU_TIMEZONES,
  T,
  ageInMonths,
  fmt,
  getFeedState,
  hashTgId,
  pauseFeed,
  resumeFeed,
  setFeedSlot,
  setFeedTimezone,
  subscribeFeed,
  timesLabel,
  timezoneLabel,
  unsubscribeFeed,
  type FeedSlot,
  type FeedStatePayload,
} from '@mama/shared'
import type { Db } from '@mama/shared/db'
import { InlineKeyboard, type Bot, type Context } from 'grammy'
import type { Logger } from 'pino'

type Helpers = {
  db: Db
  log: Logger
  publicUrl: string
  show: (ctx: Context, text: string, keyboard: InlineKeyboard, parseHtml?: boolean) => Promise<void>
  mainMenu: () => InlineKeyboard
  /** Кнопки года рождения; `feed` — после выбора месяца продолжить подписку. */
  ageYearKeyboard: (next: 'feed') => Promise<InlineKeyboard>
}

export const slotLabel = (slot: FeedSlot) => ({ morning: T.feedSlotMorning, day: T.feedSlotDay, evening: T.feedSlotEvening })[slot]

const pauseLabel = (days: number) => (days === 7 ? T.feedPauseWeek : days === 14 ? T.feedPause2Weeks : T.feedPauseMonth)

export const dateIn = (iso: string | Date, timezone: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { timeZone: timezone })

/** Строка о возрасте под статусом ленты: не указан, младше 3, 18 и старше. */
function ageNote(st: FeedStatePayload): string {
  if (!st.birth) return `\n\n${T.feedNeedAge}`
  const months = ageInMonths(st.birth.year, st.birth.month)
  if (months < FEED_MIN_MONTHS) return `\n\n${T.feedWaitThree}`
  if (months >= FEED_MAX_MONTHS) return `\n\n${T.feedTooOld}`
  return ''
}

export function setupFeedBot(bot: Bot, { db, log, publicUrl, show, mainMenu, ageYearKeyboard }: Helpers) {
  const slotKeyboard = () => {
    const kb = new InlineKeyboard()
    for (const slot of ['morning', 'day', 'evening'] as const) kb.text(slotLabel(slot), `feed:slot:${slot}`).row()
    return kb.text(T.backButton, 'feed')
  }

  async function showFeed(ctx: Context) {
    const st = await getFeedState(db, ctx.from!.id)
    const times = timesLabel(st.perWeek)
    if (!st.consent) {
      const text = `${fmt(T.feedOffer, { times })}\n\n<a href="${publicUrl}/rassylka">${T.feedTermsLink}</a>`
      const kb = new InlineKeyboard().text(T.feedSubscribe, 'feed:sub').text(T.feedNotNow, 'feed:no').row().text(T.backButton, 'menu')
      return show(ctx, text, kb, true)
    }
    // Согласие из окна этапа 1 без выбранного времени (Л3): предлагаем настроить.
    if (!st.settings) {
      return show(ctx, T.feedSetupNeeded, new InlineKeyboard().text(T.feedSetupButton, 'feed:sub').row().text(T.backButton, 'menu'))
    }
    const { slot, timezone, pausedUntil } = st.settings
    const status = pausedUntil
      ? fmt(T.feedStatusPaused, { date: dateIn(pausedUntil, timezone) })
      : fmt(T.feedStatusOn, { slot: slotLabel(slot), times, tz: timezoneLabel(timezone) })
    const kb = new InlineKeyboard()
      .text(T.feedTimeButton, 'feed:time')
      .text(T.feedTzButton, 'feed:tz')
      .row()
      .text(pausedUntil ? T.feedResumeButton : T.feedPauseButton, pausedUntil ? 'feed:resume' : 'feed:pause')
      .row()
      .text(T.feedUnsubButton, 'feed:unsub')
      .row()
      .text(T.backButton, 'menu')
    await show(ctx, status + ageNote(st), kb)
  }

  bot.callbackQuery('feed', showFeed)
  bot.callbackQuery('feed:no', (ctx) => show(ctx, T.feedNotNowDone, mainMenu()))

  /** Подписка: сначала месяц и год рождения, если их нет (ТЗ 6.3), потом время (ТЗ 7). */
  async function startSubscribe(ctx: Context) {
    const st = await getFeedState(db, ctx.from!.id)
    if (!st.birth) return show(ctx, T.feedAskAge, await ageYearKeyboard('feed'))
    if (ageInMonths(st.birth.year, st.birth.month) >= FEED_MAX_MONTHS) return show(ctx, T.feedTooOld, mainMenu())
    await show(ctx, T.feedAskSlot, slotKeyboard())
  }
  bot.callbackQuery('feed:sub', startSubscribe)
  bot.callbackQuery('feed:time', (ctx) => show(ctx, T.feedAskSlot, slotKeyboard()))

  bot.callbackQuery(/^feed:slot:(morning|day|evening)$/, async (ctx) => {
    const tgId = ctx.from.id
    const slot = ctx.match[1] as FeedSlot
    const st = await getFeedState(db, tgId)
    // Уже подписана — меняем только время, пауза остаётся.
    if (st.settings) {
      await setFeedSlot(db, tgId, slot)
      return showFeed(ctx)
    }
    const res = await subscribeFeed(db, tgId, { slot })
    if (res === 'need_birth') return show(ctx, T.feedAskAge, await ageYearKeyboard('feed'))
    if (res === 'too_old') return show(ctx, T.feedTooOld, mainMenu())
    log.info({ user: hashTgId(tgId) }, 'feed subscribed (bot)')
    const next = await getFeedState(db, tgId)
    const text = fmt(T.feedSubscribed, {
      times: timesLabel(next.perWeek),
      slot: slotLabel(slot),
      tz: timezoneLabel(next.settings?.timezone ?? ''),
    })
    await show(ctx, text + ageNote(next), new InlineKeyboard().text(T.feedTzButton, 'feed:tz').row().text(T.backButton, 'menu'))
  })

  bot.callbackQuery('feed:tz', async (ctx) => {
    const kb = new InlineKeyboard()
    RU_TIMEZONES.forEach((z, i) => {
      kb.text(z.label, `feed:tz:${i}`)
      if (i % 2 === 1) kb.row()
    })
    await show(ctx, T.feedAskTz, kb.row().text(T.backButton, 'feed'))
  })
  bot.callbackQuery(/^feed:tz:(\d+)$/, async (ctx) => {
    const zone = RU_TIMEZONES[Number(ctx.match[1])]
    if (zone) await setFeedTimezone(db, ctx.from.id, zone.id)
    await showFeed(ctx)
  })

  bot.callbackQuery('feed:pause', async (ctx) => {
    const kb = new InlineKeyboard()
    for (const days of FEED_PAUSE_DAYS) kb.text(pauseLabel(days), `feed:pause:${days}`)
    await show(ctx, T.feedAskPause, kb.row().text(T.backButton, 'feed'))
  })
  bot.callbackQuery(/^feed:pause:(7|14|30)$/, async (ctx) => {
    const tgId = ctx.from.id
    await pauseFeed(db, tgId, Number(ctx.match[1]) as (typeof FEED_PAUSE_DAYS)[number])
    const st = await getFeedState(db, tgId)
    if (!st.settings?.pausedUntil) return showFeed(ctx)
    await show(ctx, fmt(T.feedPaused, { date: dateIn(st.settings.pausedUntil, st.settings.timezone) }), new InlineKeyboard().text(T.backButton, 'feed'))
  })
  bot.callbackQuery('feed:resume', async (ctx) => {
    await resumeFeed(db, ctx.from.id)
    await show(ctx, T.feedResumed, new InlineKeyboard().text(T.backButton, 'feed'))
  })

  bot.callbackQuery('feed:unsub', (ctx) =>
    show(ctx, T.feedUnsubConfirm, new InlineKeyboard().text(T.feedUnsubYes, 'feed:unsub:yes').text(T.revokeNo, 'feed')),
  )
  bot.callbackQuery('feed:unsub:yes', async (ctx) => {
    const res = await unsubscribeFeed(db, ctx.from.id)
    if (res === 'revoked') log.info({ user: hashTgId(ctx.from.id) }, 'feed unsubscribed (bot)')
    await show(ctx, T.feedUnsubDone, mainMenu())
  })

  return { showFeed, startSubscribe }
}
