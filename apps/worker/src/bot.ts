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
  getConfig,
  getConsentState,
  getSettings,
  hashTgId,
  isValidBirth,
  monthsLabel,
  setBotBlocked,
  setChildBirth,
  touchUser,
} from '@mama/shared'
import type { Db } from '@mama/shared/db'
import { Bot, InlineKeyboard, type Context } from 'grammy'
import type { Logger } from 'pino'

export type BotDeps = { db: Db; log: Logger; publicUrl: string; channelUrl: string }

const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } }

export function setupBot(bot: Bot, { db, log, publicUrl, channelUrl }: BotDeps) {
  const vars = { siteUrl: publicUrl, channelUrl }
  const appUrl = (screen?: string) => `${publicUrl}/app${screen ? `?screen=${screen}` : ''}`

  const openApp = (text: string = T.openAppButton) => new InlineKeyboard().webApp(text, appUrl())
  const mainMenu = () =>
    // «Записать навык» и «Лента» появятся на этапе 2: в меню только то, что работает.
    new InlineKeyboard().webApp(T.openAppButton, appUrl()).row().text(T.helpButton, 'help').text(T.settingsButton, 'settings')

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
      .webApp(T.myConsentsButton, appUrl('consents'))
      .row()
      .text(T.revokeButton, 'revoke')
      .row()
      .text(T.backButton, 'menu')
    await show(ctx, `${T.settingsTitle}\n\n${ageLine}`, kb)
  }
  bot.command('settings', showSettings)
  bot.callbackQuery('settings', showSettings)

  // 8. Возраст ребёнка: месяц и год кнопками, только по желанию (ТЗ 6.3).
  bot.callbackQuery('age', async (ctx) => {
    const kb = new InlineKeyboard()
    for (const y of birthYearOptions()) kb.text(String(y), `age:y:${y}`)
    kb.row()
    if (await getChildBirth(db, ctx.from.id)) kb.text(T.ageClearButton, 'age:clear').row()
    kb.text(T.backButton, 'settings')
    await show(ctx, T.ageAskYear, kb)
  })

  bot.callbackQuery(/^age:y:(\d{4})$/, async (ctx) => {
    const year = Number(ctx.match[1])
    const kb = new InlineKeyboard()
    MONTHS_RU.forEach((name, i) => {
      if (!isValidBirth(year, i + 1)) return
      kb.text(name, `age:m:${year}:${i + 1}`)
      if (i % 3 === 2) kb.row()
    })
    kb.row().text(T.backButton, 'age')
    await show(ctx, T.ageAskMonth, kb)
  })

  bot.callbackQuery(/^age:m:(\d{4}):(\d{1,2})$/, async (ctx) => {
    const year = Number(ctx.match[1])
    const month = Number(ctx.match[2])
    if (!isValidBirth(year, month)) return ctx.answerCallbackQuery()
    await setChildBirth(db, ctx.from.id, { year, month })
    let text = fmt(T.ageSaved, { month: MONTHS_RU[month - 1]!, year: String(year) })
    if (ageInMonths(year, month) < 3) text += `\n\n${T.ageTooYoung}`
    await show(ctx, text, new InlineKeyboard().text(T.backButton, 'settings'))
  })

  bot.callbackQuery('age:clear', async (ctx) => {
    await setChildBirth(db, ctx.from.id, null)
    await show(ctx, T.ageCleared, new InlineKeyboard().text(T.backButton, 'settings'))
  })

  // 9. Свободный текст, голос, файлы (ТЗ 6.4). TODO(шаг 7): текст — поиск после проверки «красных слов».
  bot.on('message:voice', (ctx) => ctx.reply(T.voiceNotSupported, { reply_markup: openApp() }))
  bot.on('message:text', (ctx) => ctx.reply(T.searchSoon, { reply_markup: openApp() }))
  bot.on('message', (ctx) => ctx.reply(T.onlyTextAndVoice, { reply_markup: openApp() }))
  // Устаревшие кнопки, которых больше нет.
  bot.on('callback_query', (ctx) => show(ctx, T.mainMenu, mainMenu()))

  return { mainMenu, openApp }
}
