// Процесс worker: бот grammY (long polling) + обработчики очередей BullMQ.
import { autoRetry } from '@grammyjs/auto-retry'
import { apiThrottler } from '@grammyjs/transformer-throttler'
import {
  DEFAULT_TEXTS,
  QUEUE_BOT,
  checkAccess,
  createLogger,
  createRedis,
  fmt,
  getConsentState,
  getSettings,
  hashTgId,
  type BotJob,
} from '@mama/shared'
import { getDb, users } from '@mama/shared/db'
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { Bot, GrammyError, InlineKeyboard, type Context } from 'grammy'

const log = createLogger('worker')

const token = process.env.BOT_TOKEN
if (!token) {
  log.fatal('BOT_TOKEN не задан — бот не запущен')
  process.exit(1)
}
const publicUrl = (process.env.PUBLIC_URL ?? 'https://localhost').replace(/\/$/, '')
const webAppUrl = `${publicUrl}/app`
const channelUrl = process.env.CHANNEL_URL ?? 'https://t.me/detimam_pro'
const vars = { siteUrl: publicUrl, channelUrl }

const db = getDb()
const bot = new Bot(token)
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }))
bot.api.config.use(apiThrottler())

const openAppKeyboard = (text: string = DEFAULT_TEXTS.openAppButton) => new InlineKeyboard().webApp(text, webAppUrl)

async function betaPrefix(): Promise<string> {
  const { betaBanner } = await getSettings(db)
  return betaBanner ? `${DEFAULT_TEXTS.betaBot}\n\n` : ''
}

// 1. Только личные чаты. Посты канала — шаг 9 плана.
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private' || !ctx.from || ctx.from.is_bot) return
  await next()
})

// 2. Закрытый режим (ТЗ 14): не из списка доступа — «Бот пока в разработке», ничего не пишем и не логируем ID.
bot.use(async (ctx, next) => {
  const { allowed } = await checkAccess(db, ctx.from!.id)
  if (allowed) return next()
  log.debug('update from user outside access list')
  if (ctx.callbackQuery) await ctx.answerCallbackQuery()
  await ctx.reply(fmt(DEFAULT_TEXTS.notInAccessList, vars), { link_preview_options: { is_disabled: true } })
})

// 3. Приветствие (ТЗ 6.1). Ничего не записывает: мама появляется в базе только с основным согласием.
bot.command('start', async (ctx) => {
  await ctx.reply((await betaPrefix()) + fmt(DEFAULT_TEXTS.welcome, vars), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: openAppKeyboard(DEFAULT_TEXTS.startButton),
  })
})

bot.command('help', async (ctx) => {
  await ctx.reply((await betaPrefix()) + fmt(DEFAULT_TEXTS.help, vars), {
    link_preview_options: { is_disabled: true },
    reply_markup: openAppKeyboard(),
  })
})

bot.command('app', async (ctx) => {
  await ctx.reply(DEFAULT_TEXTS.openAppButton, { reply_markup: openAppKeyboard() })
})

// 4. Всё остальное: без действующего основного согласия — в окно согласий (ТЗ 6.1).
// TODO(шаг 2): главное меню, /settings, /revoke, ответы на голос и файлы (ТЗ 6.2–6.5).
bot.on(['message', 'callback_query'], async (ctx: Context) => {
  if (ctx.callbackQuery) await ctx.answerCallbackQuery()
  const { pdValid } = await getConsentState(db, ctx.from!.id)
  const text = pdValid ? DEFAULT_TEXTS.notReadyYet : DEFAULT_TEXTS.needConsent
  await ctx.reply(text, { reply_markup: openAppKeyboard() })
})

bot.catch(({ error, ctx }) => {
  log.error({ err: error, user: ctx.from ? hashTgId(ctx.from.id) : undefined }, 'bot update failed')
})

/** Мама заблокировала бот → рассылки ей отключаются (ТЗ 13). */
async function markBlocked(tgId: number, err: unknown) {
  if (err instanceof GrammyError && err.error_code === 403) {
    await db.update(users).set({ botBlocked: true }).where(eq(users.tgId, tgId))
    return true
  }
  return false
}

const worker = new Worker<BotJob['data'], void, BotJob['name']>(
  QUEUE_BOT,
  async (job) => {
    if (job.name === 'consent-granted') {
      const { tgId } = job.data
      try {
        await bot.api.sendMessage(tgId, DEFAULT_TEXTS.afterConsent, { reply_markup: openAppKeyboard() })
      } catch (err) {
        if (!(await markBlocked(tgId, err))) throw err
      }
    }
  },
  { connection: createRedis(), concurrency: 5 },
)
worker.on('failed', (job, err) => log.error({ err, job: job?.name }, 'bot job failed'))

async function configureBot() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Начать' },
    { command: 'app', description: 'Открыть приложение' },
    { command: 'help', description: 'Помощь' },
  ])
  try {
    // Кнопка меню рядом с полем ввода (ТЗ 6.2). Telegram принимает только https.
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: DEFAULT_TEXTS.openAppButton, web_app: { url: webAppUrl } },
    })
  } catch (err) {
    log.warn({ err }, 'не удалось поставить кнопку меню (PUBLIC_URL должен быть https)')
  }
}

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down')
  await Promise.allSettled([bot.stop(), worker.close()])
  await db.$client.end({ timeout: 5 })
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

await configureBot()
log.info({ webAppUrl }, 'bot starting')
await bot.start({
  drop_pending_updates: false,
  allowed_updates: ['message', 'callback_query'],
  onStart: (me) => log.info({ bot: me.username }, 'bot started'),
})
