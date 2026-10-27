// Процесс worker: бот grammY (long polling) + обработчики очередей BullMQ.
import { autoRetry } from '@grammyjs/auto-retry'
import { apiThrottler } from '@grammyjs/transformer-throttler'
import { DEFAULT_TEXTS, QUEUE_BOT, createLogger, createRedis, hashTgId, setBotBlocked, type BotJob } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { Worker } from 'bullmq'
import { Bot, GrammyError } from 'grammy'
import { setupBot } from './bot'

const log = createLogger('worker')

const token = process.env.BOT_TOKEN
if (!token) {
  log.fatal('BOT_TOKEN не задан — бот не запущен')
  process.exit(1)
}
const publicUrl = (process.env.PUBLIC_URL ?? 'https://localhost').replace(/\/$/, '')
const channelUrl = process.env.CHANNEL_URL ?? 'https://t.me/detimam_pro'

const db = getDb()
const bot = new Bot(token)
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }))
bot.api.config.use(apiThrottler())

const { mainMenu } = setupBot(bot, { db, log, publicUrl, channelUrl })

bot.catch(({ error, ctx }) => {
  log.error({ err: error, user: ctx.from ? hashTgId(ctx.from.id) : undefined }, 'bot update failed')
})

/** Сообщение маме из очереди. Заблокировала бот — помечаем, рассылки ей не идут (ТЗ 13). */
async function sendToUser(tgId: number, send: () => Promise<unknown>) {
  try {
    await send()
  } catch (err) {
    if (err instanceof GrammyError && err.error_code === 403) {
      await setBotBlocked(db, tgId, true)
      return
    }
    throw err
  }
}

const worker = new Worker<BotJob['data'], void, BotJob['name']>(
  QUEUE_BOT,
  async (job) => {
    const { tgId } = job.data
    switch (job.name) {
      case 'consent-granted':
        // После окна согласий в чате появляется главное меню (ТЗ 6.1, шаг 3).
        await sendToUser(tgId, () => bot.api.sendMessage(tgId, DEFAULT_TEXTS.afterConsent, { reply_markup: mainMenu() }))
        break
      case 'data-deleted':
        // Отзыв из приложения: последнее сообщение в чат (ТЗ 6.5).
        await sendToUser(tgId, () => bot.api.sendMessage(tgId, DEFAULT_TEXTS.revokeDone))
        break
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
    { command: 'settings', description: 'Настройки' },
    { command: 'revoke', description: 'Отозвать согласие и удалить данные' },
  ])
  try {
    // Кнопка меню рядом с полем ввода (ТЗ 6.2). Telegram принимает только https.
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: DEFAULT_TEXTS.openAppButton, web_app: { url: `${publicUrl}/app` } },
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
log.info({ publicUrl }, 'bot starting')
await bot.start({
  allowed_updates: ['message', 'callback_query', 'my_chat_member'],
  onStart: (me) => log.info({ bot: me.username }, 'bot started'),
})
