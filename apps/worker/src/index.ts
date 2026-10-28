// Процесс worker: бот grammY (long polling) + обработчики очередей BullMQ.
import { autoRetry } from '@grammyjs/auto-retry'
import { apiThrottler } from '@grammyjs/transformer-throttler'
import { QUEUE_BOT, T, createLogger, createRedis, getConfig, hashTgId, setBotBlocked, type BotJob } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { Worker } from 'bullmq'
import { Bot, GrammyError } from 'grammy'
import { type AnnounceData, sendAnnounce } from './announce'
import { type SendAudioData, sendAudio } from './audio'
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

// Отдельное соединение под кеш file_id и лимит поиска: соединение BullMQ занято блокирующими командами.
const cache = createRedis()
const { mainMenu } = setupBot(bot, { db, log, publicUrl, channelUrl, redis: cache })

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
    await getConfig(db)
    switch (job.name) {
      case 'consent-granted':
        // После окна согласий в чате появляется главное меню (ТЗ 6.1).
        await sendToUser(tgId, () => bot.api.sendMessage(tgId, T.afterConsent, { reply_markup: mainMenu() }))
        break
      case 'data-deleted':
        // Отзыв из приложения: последнее сообщение в чат (ТЗ 6.5).
        await sendToUser(tgId, () => bot.api.sendMessage(tgId, T.revokeDone))
        break
      case 'test-announce':
        await sendAnnounce(bot.api, log, publicUrl, job.data as AnnounceData)
        break
      case 'send-audio':
        await sendToUser(tgId, () => sendAudio(bot.api, cache, job.data as SendAudioData))
        break
    }
  },
  { connection: createRedis(), concurrency: 5 },
)
worker.on('failed', (job, err) => log.error({ err, job: job?.name }, 'bot job failed'))

/** Описание бота — текст автора (ТЗ 6.8). Меняется в админке, доезжает при проверке раз в 5 минут. */
let appliedDescription = ''
async function syncDescription() {
  await getConfig(db)
  const key = `${T.botDescription}|${T.botShortDescription}|${T.openAppButton}`
  if (key === appliedDescription) return
  await bot.api.setMyDescription(T.botDescription)
  await bot.api.setMyShortDescription(T.botShortDescription)
  try {
    // Кнопка меню рядом с полем ввода (ТЗ 6.2). Telegram принимает только https.
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: T.openAppButton, web_app: { url: `${publicUrl}/app` } },
    })
  } catch (err) {
    log.warn({ err }, 'не удалось поставить кнопку меню (PUBLIC_URL должен быть https)')
  }
  appliedDescription = key
}

async function configureBot() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Начать' },
    { command: 'app', description: 'Открыть приложение' },
    { command: 'help', description: 'Помощь' },
    { command: 'settings', description: 'Настройки' },
    { command: 'revoke', description: 'Отозвать согласие и удалить данные' },
  ])
  await syncDescription()
  setInterval(() => syncDescription().catch((err: unknown) => log.warn({ err }, 'bot description sync failed')), 5 * 60_000).unref()
}

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down')
  await Promise.allSettled([bot.stop(), worker.close(), cache.quit()])
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
