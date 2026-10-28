// Процесс worker: бот grammY (long polling) + обработчики очередей BullMQ.
import { autoRetry } from '@grammyjs/auto-retry'
import { apiThrottler } from '@grammyjs/transformer-throttler'
import {
  QUEUE_AI,
  QUEUE_BOT,
  T,
  createLogger,
  createRedis,
  dueReminders,
  fmt,
  getConfig,
  hashTgId,
  markReminded,
  setBotBlocked,
  type BotJob,
} from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { Queue, Worker } from 'bullmq'
import { Bot, GrammyError, InlineKeyboard } from 'grammy'
import type { Message } from 'grammy/types'
import { type AnnounceData, sendAnnounce } from './announce'
import { type SendAudioData, sendAudio } from './audio'
import { aiProvider, internalApi, runGroupBlocks } from './ai'
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

// Связь с web для канала и очереди ai (ТЗ 9.9). В Docker — http://web:3000.
const callWeb = internalApi((process.env.WEB_INTERNAL_URL ?? 'http://web:3000').replace(/\/$/, ''), process.env.INTERNAL_SECRET ?? '')
const channelId = Number(process.env.CHANNEL_ID) || null

/** Картинка поста — web сохранит её в «Медиа» (для каруселей — и распознает текст). */
async function photoOf(msg: Message) {
  const size = msg.photo?.[msg.photo.length - 1]
  if (!size || (size.file_size ?? 0) > 10 * 1024 * 1024) return []
  const file = await bot.api.getFile(size.file_id)
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)
  if (!res.ok) return []
  return [{ base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType: 'image/jpeg', name: `post-${msg.message_id}.jpg` }]
}

const { mainMenu } = setupBot(bot, {
  db,
  log,
  publicUrl,
  channelUrl,
  redis: cache,
  channel: channelId
    ? {
        id: channelId,
        onPost: async (msg) => {
          await callWeb('channel/post', { message: msg, mediaGroupId: msg.media_group_id, images: await photoOf(msg) })
        },
        onEdited: async (msg) => {
          await callWeb('channel/edited', { postId: msg.message_id, text: msg.text ?? msg.caption ?? '' })
        },
      }
    : undefined,
})

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


/** Напоминание за 3 дня до конца подписки (ТЗ 8.6, шаблон 07 §7). Закрытие по сроку — само: доступ считается по дате. */
async function remindSubscriptions() {
  for (const r of await dueReminders(db)) {
    const date = r.endsAt.toLocaleDateString('ru-RU')
    await sendToUser(r.tgId, () => bot.api.sendMessage(r.tgId, fmt(T.subscriptionReminder, { date }), { reply_markup: mainMenu() }))
    await markReminded(db, r.userId)
  }
}

const worker = new Worker<BotJob['data'], void, BotJob['name']>(
  QUEUE_BOT,
  async (job) => {
    // У задачи расписания (subscriptions-tick) мамы нет.
    const tgId = job.data.tgId ?? 0
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
      case 'subscription-paid': {
        const { endsAt } = job.data as Extract<BotJob, { name: 'subscription-paid' }>['data']
        const date = new Date(endsAt).toLocaleDateString('ru-RU')
        await sendToUser(tgId, () => bot.api.sendMessage(tgId, fmt(T.subscriptionPaid, { date }), { reply_markup: mainMenu() }))
        break
      }
      case 'subscriptions-tick':
        await remindSubscriptions()
        break
      case 'channel-button': {
        // Кнопка под постом канала: url-кнопка (web_app в каналах нельзя), ведёт в приложение на материал.
        const { postId, materialId } = job.data as Extract<BotJob, { name: 'channel-button' }>['data']
        if (!channelId) break
        const link = process.env.MINIAPP_URL
          ? `${process.env.MINIAPP_URL}?startapp=m${materialId}`
          : `https://t.me/${bot.botInfo.username}?startapp=m${materialId}`
        await bot.api
          .editMessageReplyMarkup(channelId, postId, { reply_markup: new InlineKeyboard().url(T.openAppButton, link) })
          .catch((err: unknown) => log.warn({ err, postId }, 'channel button failed (нужно право редактировать сообщения)'))
        break
      }
      case 'send-audio':
        await sendToUser(tgId, () => sendAudio(bot.api, cache, job.data as SendAudioData))
        break
    }
  },
  { connection: createRedis(), concurrency: 5 },
)
worker.on('failed', (job, err) => log.error({ err, job: job?.name }, 'bot job failed'))

// Очередь ai: сборка статей из постов канала. По одной задаче за раз — запросы к ИИ тяжёлые.
const aiWorker = new Worker<{ postIds?: number[] | null }>(
  QUEUE_AI,
  async (job) => {
    if (job.name === 'group-blocks') await runGroupBlocks(callWeb, aiProvider(), log, job.data.postIds ?? null)
  },
  { connection: createRedis(), concurrency: 1 },
)
aiWorker.on('failed', (job, err) => log.error({ err, job: job?.name }, 'ai job failed'))

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

/** Повторяющиеся задачи: проверка подписок раз в час. Upsert не плодит дублей при перезапуске. */
const scheduler = new Queue(QUEUE_BOT, { connection: createRedis() })
await scheduler.upsertJobScheduler('subscriptions-tick', { every: 60 * 60 * 1000 }, { name: 'subscriptions-tick', data: {} })

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
  await Promise.allSettled([bot.stop(), worker.close(), aiWorker.close(), scheduler.close(), cache.quit()])
  await db.$client.end({ timeout: 5 })
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

await configureBot()
log.info({ publicUrl }, 'bot starting')
await bot.start({
  allowed_updates: ['message', 'callback_query', 'my_chat_member', 'pre_checkout_query', 'channel_post', 'edited_channel_post'],
  onStart: (me) => log.info({ bot: me.username }, 'bot started'),
})
