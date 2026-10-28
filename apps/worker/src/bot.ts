// Бот: вход, гейт согласия, главное меню, настройки, возраст ребёнка, отзыв согласия (ТЗ 6).
import {
  MONTHS_RU,
  T,
  ageInMonths,
  birthYearOptions,
  checkAccess,
  deleteUserData,
  fmt,
  getActiveSubscriptionUntil,
  getChildBirth,
  bumpWantedTopic,
  findRedWord,
  getConfig,
  getConsentState,
  getRedWords,
  getSettings,
  hashTgId,
  isValidBirth,
  listTopics,
  monthsLabel,
  processPayment,
  setBotBlocked,
  searchMaterials,
  setChildBirth,
  takeSearchQuota,
  touchUser,
} from '@mama/shared'
import type { Db } from '@mama/shared/db'
import { Bot, InlineKeyboard, type Context } from 'grammy'
import type { Message } from 'grammy/types'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import { setupFeedBot } from './feed-bot'

export type BotDeps = {
  db: Db
  log: Logger
  publicUrl: string
  channelUrl: string
  /** Счётчик лимита поиска (ТЗ 10.1). */
  redis: Pick<Redis, 'incr' | 'expire'>
  /** Канал автора, где бот — администратор (ТЗ 9.9): новые и изменённые посты уходят в админку. */
  channel?: {
    id: number
    onPost: (msg: Message) => Promise<void>
    onEdited: (msg: Message) => Promise<void>
  }
}

const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } }

export function setupBot(bot: Bot, { db, log, publicUrl, channelUrl, redis, channel }: BotDeps) {
  const vars = { siteUrl: publicUrl, channelUrl }
  const appUrl = (screen?: string) => `${publicUrl}/app${screen ? `?screen=${screen}` : ''}`

  const openApp = (text: string = T.openAppButton) => new InlineKeyboard().webApp(text, appUrl())
  const mainMenu = () =>
    // В меню только то, что работает (ТЗ 6.2): «Записать навык» — с включённым календарём.
    new InlineKeyboard()
      .webApp(T.openAppButton, appUrl())
      .row()
      .text(T.feedButton, 'feed')
      .row()
      .text(T.helpButton, 'help')
      .text(T.settingsButton, 'settings')

  const betaPrefix = async () => ((await getSettings(db)).betaBanner ? `${T.betaBot}\n\n` : '')

  /** Ответ на кнопку: правим сообщение с меню, на команду — шлём новое. */
  async function show(ctx: Context, text: string, keyboard: InlineKeyboard, parseHtml = false) {
    const extra = { reply_markup: keyboard, ...(parseHtml ? html : {}) }
    if (ctx.callbackQuery?.message) {
      await ctx.answerCallbackQuery()
      await ctx.editMessageText(text, extra).catch(async (err: unknown) => {
        // «message is not modified» — та же кнопка дважды, это не ошибка.
        if (!String(err).includes('not modified')) await ctx.reply(text, extra)
      })
    } else {
      await ctx.reply(text, extra)
    }
  }

  // 0а. Посты канала автора → «Входящие из канала» (ТЗ 9.9, приёмка 33). Другие каналы игнорируем.
  bot.on('channel_post', async (ctx) => {
    if (channel && ctx.chat.id === channel.id) await channel.onPost(ctx.channelPost)
  })
  bot.on('edited_channel_post', async (ctx) => {
    if (channel && ctx.chat.id === channel.id) await channel.onEdited(ctx.editedChannelPost)
  })

  // 0. Оплата Telegram Stars (TODO(Р21): включается PAYMENT_PROVIDER=stars). У pre_checkout_query нет чата,
  // поэтому до фильтра личных чатов. Платёж обрабатывается идемпотентно (приёмка 17).
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery
    const { subscription } = await getConfig(db)
    const plan = subscription.plans.find((p) => `sub:${p.id}` === q.invoice_payload)
    const ok = Boolean(plan && q.currency === 'XTR' && q.total_amount === plan.priceStars)
    await ctx.answerPreCheckoutQuery(ok, ok ? undefined : { error_message: T.loadError })
  })
  bot.on('message:successful_payment', async (ctx) => {
    const p = ctx.message.successful_payment
    const { subscription } = await getConfig(db)
    const plan = subscription.plans.find((x) => `sub:${x.id}` === p.invoice_payload)
    if (!plan) {
      log.error({ user: hashTgId(ctx.from.id) }, 'successful_payment with unknown plan')
      return
    }
    const res = await processPayment(db, {
      provider: 'stars',
      providerPaymentId: p.telegram_payment_charge_id,
      tgId: ctx.from.id,
      plan,
      amount: p.total_amount,
      currency: p.currency,
    })
    log.info({ user: hashTgId(ctx.from.id), status: res.status }, 'stars payment processed')
    if (res.endsAt) await ctx.reply(fmt(T.subscriptionPaid, { date: res.endsAt.toLocaleDateString('ru-RU') }), { reply_markup: openApp() })
  })

  // 1. Только личные чаты. Посты канала — шаг 9 плана.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== 'private' || !ctx.from || ctx.from.is_bot) return
    // Тексты и настройки из админки (TTL 30 с): живой объект T обновляется здесь.
    await getConfig(db)
    await next()
  })

  // 2. Мама заблокировала или разблокировала бот (ТЗ 13). Ничего не отвечаем; без записи о маме — ничего не пишем.
  bot.on('my_chat_member', async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status
    await setBotBlocked(db, ctx.from.id, status === 'kicked')
  })

  // 3. Закрытый режим (ТЗ 14): не из списка доступа — «Бот пока в разработке», ничего не пишем и не логируем ID.
  bot.use(async (ctx, next) => {
    const { allowed } = await checkAccess(db, ctx.from!.id)
    if (allowed) return next()
    log.debug('update from user outside access list')
    if (ctx.callbackQuery) await ctx.answerCallbackQuery()
    await ctx.reply(fmt(T.notInAccessList, vars), { link_preview_options: { is_disabled: true } })
  })

  // 4. Отзыв согласия доступен всегда, даже с устаревшей версией согласия (ТЗ 6.5).
  async function askRevoke(ctx: Context) {
    const tgId = ctx.from!.id
    const state = await getConsentState(db, tgId)
    const exists = state.userId !== null
    if (!exists) return show(ctx, T.revokeNothing, new InlineKeyboard())
    let text = T.revokeConfirm
    const paidUntil = await getActiveSubscriptionUntil(db, tgId)
    if (paidUntil) {
      text += `\n\n${fmt(T.revokeSubscription, { ...vars, date: paidUntil.toLocaleDateString('ru-RU') })}`
    }
    await show(ctx, text, new InlineKeyboard().text(T.revokeYes, 'revoke:yes').text(T.revokeNo, 'revoke:no'), true)
  }

  bot.command('revoke', askRevoke)
  bot.callbackQuery('revoke', askRevoke)
  bot.callbackQuery('revoke:yes', async (ctx) => {
    const deleted = await deleteUserData(db, ctx.from.id)
    if (deleted) log.info({ user: hashTgId(ctx.from.id) }, 'user data deleted (bot)')
    await show(ctx, deleted ? T.revokeDone : T.revokeNothing, new InlineKeyboard())
  })
  bot.callbackQuery('revoke:no', (ctx) => show(ctx, T.revokeCancelled, mainMenu()))

  // 5. /start: приветствие для новых, меню — для тех, у кого согласие уже есть (ТЗ 6.1).
  // Ничего не записывает: мама появляется в базе только с основным согласием.
  bot.command('start', async (ctx) => {
    const { pdValid } = await getConsentState(db, ctx.from!.id)
    if (pdValid) return show(ctx, T.mainMenu, mainMenu())
    await ctx.reply((await betaPrefix()) + fmt(T.welcome, vars), { ...html, reply_markup: openApp(T.startButton) })
  })

  // 5а. «Красные слова» — до любого действия, даже до согласия: экстренный текст ничего не записывает (ТЗ 10.3).
  // Текст сообщения не логируется и не сохраняется (ТЗ 11.4).
  bot.on('message:text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next()
    const { words, emergencyText } = await getRedWords(db)
    if (!findRedWord(ctx.message.text, words)) return next()
    log.info('red word matched')
    await ctx.reply(emergencyText, html)
  })

  // 6. Гейт: без действующего основного согласия любое действие, включая старые кнопки, ведёт в окно согласий.
  bot.use(async (ctx, next) => {
    const tgId = ctx.from!.id
    const { pdValid } = await getConsentState(db, tgId)
    if (!pdValid) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery()
      await ctx.reply(T.needConsent, { reply_markup: openApp() })
      return
    }
    await touchUser(db, tgId)
    await next()
  })

  // 7. Меню, помощь, настройки (ТЗ 6.2, 6.7).
  bot.command('app', (ctx) => show(ctx, T.mainMenu, mainMenu()))
  bot.callbackQuery('menu', (ctx) => show(ctx, T.mainMenu, mainMenu()))

  const helpText = async () => (await betaPrefix()) + fmt(T.help, vars)
  bot.command('help', async (ctx) => show(ctx, await helpText(), new InlineKeyboard().text(T.backButton, 'menu'), true))
  bot.callbackQuery('help', async (ctx) => show(ctx, await helpText(), new InlineKeyboard().text(T.backButton, 'menu'), true))

  async function showSettings(ctx: Context) {
    const birth = await getChildBirth(db, ctx.from!.id)
    const ageLine = birth
      ? fmt(T.settingsAge, { age: `${MONTHS_RU[birth.month - 1]} ${birth.year} (${monthsLabel(Math.max(0, ageInMonths(birth.year, birth.month)))})` })
      : T.settingsAgeEmpty
    const kb = new InlineKeyboard()
      .text(T.ageButton, 'age')
      .row()
      .text(T.feedButton, 'feed')
      .row()
      .webApp(T.myConsentsButton, appUrl('consents'))
      .row()
      .text(T.revokeButton, 'revoke')
      .row()
      .text(T.backButton, 'menu')
    await show(ctx, `${T.settingsTitle}\n\n${ageLine}`, kb)
  }
  bot.command('settings', showSettings)
  bot.callbackQuery('settings', showSettings)

  // 8. Возраст ребёнка: месяц и год кнопками, только по желанию или когда нужен ленте (ТЗ 6.3).
  // Суффикс `:f` — выбор идёт из подписки на ленту, после месяца она продолжается.
  const ageYearKeyboard = async (next?: 'feed', tgId?: number) => {
    const suffix = next === 'feed' ? ':f' : ''
    const kb = new InlineKeyboard()
    for (const y of birthYearOptions()) kb.text(String(y), `age:y:${y}${suffix}`)
    kb.row()
    if (!next && tgId && (await getChildBirth(db, tgId))) kb.text(T.ageClearButton, 'age:clear').row()
    return kb.text(T.backButton, next === 'feed' ? 'feed' : 'settings')
  }
  bot.callbackQuery('age', async (ctx) => show(ctx, T.ageAskYear, await ageYearKeyboard(undefined, ctx.from.id)))

  bot.callbackQuery(/^age:y:(\d{4})(:f)?$/, async (ctx) => {
    const year = Number(ctx.match[1])
    const suffix = ctx.match[2] ?? ''
    const kb = new InlineKeyboard()
    MONTHS_RU.forEach((name, i) => {
      if (!isValidBirth(year, i + 1)) return
      kb.text(name, `age:m:${year}:${i + 1}${suffix}`)
      if (i % 3 === 2) kb.row()
    })
    kb.row().text(T.backButton, suffix ? 'feed:sub' : 'age')
    await show(ctx, T.ageAskMonth, kb)
  })

  bot.callbackQuery(/^age:m:(\d{4}):(\d{1,2})(:f)?$/, async (ctx) => {
    const year = Number(ctx.match[1])
    const month = Number(ctx.match[2])
    if (!isValidBirth(year, month)) return ctx.answerCallbackQuery()
    await setChildBirth(db, ctx.from.id, { year, month })
    if (ctx.match[3]) return feed.startSubscribe(ctx)
    let text = fmt(T.ageSaved, { month: MONTHS_RU[month - 1]!, year: String(year) })
    if (ageInMonths(year, month) < 3) text += `\n\n${T.ageTooYoung}`
    await show(ctx, text, new InlineKeyboard().text(T.backButton, 'settings'))
  })

  bot.callbackQuery('age:clear', async (ctx) => {
    await setChildBirth(db, ctx.from.id, null)
    await show(ctx, T.ageCleared, new InlineKeyboard().text(T.backButton, 'settings'))
  })

  // 8а. Лента (ТЗ 7).
  const feed = setupFeedBot(bot, { db, log, publicUrl, show, mainMenu, ageYearKeyboard: (next) => ageYearKeyboard(next) })

  // 9. Свободный текст — поиск по материалам автора (ТЗ 6.4, 10.1); «красные слова» уже проверены выше.
  bot.on('message:voice', (ctx) => ctx.reply(T.voiceNotSupported, { reply_markup: openApp() }))
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return ctx.reply(T.mainMenu, { reply_markup: mainMenu() })
    if (!(await takeSearchQuota(redis, ctx.from.id))) return ctx.reply(T.searchLimit, { reply_markup: openApp() })
    const hits = await searchMaterials(db, ctx.message.text, 5)
    if (hits.length === 0) {
      return ctx.reply(T.searchNothing, { reply_markup: new InlineKeyboard().text(T.searchWant, 'want').row().webApp(T.openAppButton, appUrl()) })
    }
    // Только ссылки на материалы автора, своего текста нет (приёмка 19). Закрытые — с замком (ТЗ 10.1).
    const kb = new InlineKeyboard()
    for (const h of hits) kb.webApp(`${h.access === 'paid' ? '🔒 ' : ''}${h.title}`, `${publicUrl}/app?m=${h.id}`).row()
    await ctx.reply(T.searchResults, { reply_markup: kb })
  })

  // «Хочу материал на эту тему»: только тема из словаря и дата (ТЗ 11.2, Р2).
  bot.callbackQuery('want', async (ctx) => {
    const topics = await listTopics(db)
    const kb = new InlineKeyboard()
    topics.forEach((t, i) => {
      kb.text(t, `want:${i}`)
      if (i % 2 === 1) kb.row()
    })
    await show(ctx, T.searchWantPick, kb)
  })
  bot.callbackQuery(/^want:(\d+)$/, async (ctx) => {
    const topic = (await listTopics(db))[Number(ctx.match[1])]
    if (topic) await bumpWantedTopic(db, topic)
    await show(ctx, T.searchWantThanks, new InlineKeyboard().webApp(T.openAppButton, appUrl()))
  })
  bot.on('message', (ctx) => ctx.reply(T.onlyTextAndVoice, { reply_markup: openApp() }))
  // Устаревшие кнопки, которых больше нет.
  bot.on('callback_query', (ctx) => show(ctx, T.mainMenu, mainMenu()))

  return { mainMenu, openApp }
}
