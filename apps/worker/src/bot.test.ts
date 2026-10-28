// Сценарии бота на настоящем Postgres: апдейты идут через обработчики, вызовы Telegram API перехватываются.
// Запуск: TEST_DATABASE_URL=postgres://…localhost:55432/… corepack pnpm -F @mama/worker test
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { DEFAULT_TEXTS as T, grantConsents } from '@mama/shared'
import { createDb, users, type Db } from '@mama/shared/db'
import { eq } from 'drizzle-orm'
import { Bot } from 'grammy'
import type { Update } from 'grammy/types'
import pino from 'pino'
import { setupBot } from './bot'

const url = process.env.TEST_DATABASE_URL
process.env.CLOSED_MODE = 'false'
process.env.LOG_HASH_SECRET ??= 'test'

const ME = -2001 // отрицательный ID: в Telegram таких нет
let db: Db
let bot: Bot
let calls: { method: string; payload: Record<string, unknown> }[] = []
let updateId = 1

function sentTexts() {
  return calls.filter((c) => c.method === 'sendMessage' || c.method === 'editMessageText').map((c) => String(c.payload.text))
}

function buttons() {
  const last = calls.findLast((c) => c.method === 'sendMessage' || c.method === 'editMessageText')
  const markup = last?.payload.reply_markup as { inline_keyboard?: { text: string; callback_data?: string }[][] } | undefined
  return (markup?.inline_keyboard ?? []).flat().map((b) => b.callback_data ?? b.text)
}

const from = { id: ME, is_bot: false, first_name: 'Тест' }
const chat = { id: ME, type: 'private' as const, first_name: 'Тест' }

async function send(text: string) {
  const entities = text.startsWith('/') ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }] : undefined
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: updateId, date: 0, chat, from, text, entities },
  } as Update)
}

async function press(data: string) {
  await bot.handleUpdate({
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from,
      chat_instance: '1',
      data,
      message: { message_id: 1, date: 0, chat, text: 'меню' },
    },
  } as Update)
}

before(async () => {
  if (!url) return
  db = createDb(url, 2)
  bot = new Bot('1:test', { botInfo: { id: 1, is_bot: true, first_name: 'bot', username: 'test_bot' } as never })
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> })
    const result = method === 'sendMessage' || method === 'editMessageText' ? { message_id: 1, date: 0, chat, text: '' } : true
    return { ok: true, result } as never
  })
  // Лимит поиска в памяти вместо Redis.
  const counters = new Map<string, number>()
  const redis = { incr: async (k: string) => counters.set(k, (counters.get(k) ?? 0) + 1).get(k)!, expire: async () => 1 as const }
  setupBot(bot, { db, log: pino({ level: 'silent' }), publicUrl: 'https://example.test', channelUrl: 'https://t.me/x', redis: redis as never })
})

beforeEach(async () => {
  calls = []
  if (url) await db.delete(users).where(eq(users.tgId, ME))
})

after(async () => {
  if (!url) return
  await db.delete(users).where(eq(users.tgId, ME))
  await db.$client.end()
})

test('/start без согласия: дисклеймер, приветствие, кнопка «Начать»; ничего не записано', { skip: !url }, async () => {
  await send('/start')
  const [text] = sentTexts()
  assert.ok(text!.startsWith(T.betaBot), 'бета-дисклеймер первой строкой')
  assert.ok(text!.includes('Дневник спокойного материнства'))
  assert.deepEqual(buttons(), [T.startButton])
  assert.equal((await db.select().from(users).where(eq(users.tgId, ME))).length, 0)
})

test('без согласия любое действие и старые кнопки ведут в окно согласий (приёмка 1)', { skip: !url }, async () => {
  for (const action of [() => send('/help'), () => send('/settings'), () => send('привет'), () => press('settings'), () => press('age:y:2026')]) {
    calls = []
    await action()
    assert.deepEqual(sentTexts(), [T.needConsent])
  }
})

test('с согласием: меню, настройки, возраст кнопками', { skip: !url }, async () => {
  await grantConsents(db, ME, ['pd'], { isTester: true })
  await send('/start')
  assert.deepEqual(sentTexts(), [T.mainMenu])
  assert.deepEqual(buttons(), [T.openAppButton, 'help', 'settings'])

  await press('age')
  const year = new Date().getFullYear()
  assert.ok(buttons().includes(`age:y:${year}`))
  await press(`age:m:${year}:1`)
  const [row] = await db.select().from(users).where(eq(users.tgId, ME))
  assert.equal(row!.childBirthYear, year)
  assert.equal(row!.childBirthMonth, 1)

  await press(`age:m:${year + 1}:1`)
  const [same] = await db.select().from(users).where(eq(users.tgId, ME))
  assert.equal(same!.childBirthYear, year, 'дата в будущем не сохраняется')
})

test('голос, файлы и текст получают свои ответы (ТЗ 6.4)', { skip: !url }, async () => {
  await grantConsents(db, ME, ['pd'], { isTester: true })
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: updateId, date: 0, chat, from, voice: { file_id: 'v', file_unique_id: 'v', duration: 3 } },
  } as Update)
  await bot.handleUpdate({
    update_id: updateId++,
    message: { message_id: updateId, date: 0, chat, from, sticker: { file_id: 's', file_unique_id: 's', type: 'regular', width: 1, height: 1, is_animated: false, is_video: false } },
  } as Update)
  await send('абракадабра несуществующая')
  assert.deepEqual(sentTexts(), [T.voiceNotSupported, T.onlyTextAndVoice, T.searchNothing])
  assert.ok(buttons().includes('want'), 'кнопка «Хочу материал на эту тему»')
})

test('/revoke: подтверждение, удаление, повторный /start — с нуля (приёмка 3)', { skip: !url }, async () => {
  await grantConsents(db, ME, ['pd', 'feed'], { isTester: true })
  await send('/revoke')
  assert.deepEqual(sentTexts(), [T.revokeConfirm])
  assert.deepEqual(buttons(), ['revoke:yes', 'revoke:no'])

  await press('revoke:no')
  assert.equal((await db.select().from(users).where(eq(users.tgId, ME))).length, 1, 'отмена ничего не удаляет')

  await press('revoke:yes')
  assert.equal(sentTexts().at(-1), T.revokeDone)
  assert.equal((await db.select().from(users).where(eq(users.tgId, ME))).length, 0)

  calls = []
  await send('/start')
  assert.deepEqual(buttons(), [T.startButton])
})

test('блокировка бота отмечается, без записи о маме ничего не создаётся', { skip: !url }, async () => {
  const member = (status: 'kicked' | 'member') => ({
    update_id: updateId++,
    my_chat_member: {
      chat,
      from,
      date: 0,
      old_chat_member: { status: 'member', user: { id: 1, is_bot: true, first_name: 'bot' } },
      new_chat_member: status === 'kicked'
        ? { status, until_date: 0, user: { id: 1, is_bot: true, first_name: 'bot' } }
        : { status, user: { id: 1, is_bot: true, first_name: 'bot' } },
    },
  })
  await bot.handleUpdate(member('kicked') as Update)
  assert.equal((await db.select().from(users).where(eq(users.tgId, ME))).length, 0)
  assert.deepEqual(sentTexts(), [], 'на блокировку бот не отвечает')

  await grantConsents(db, ME, ['pd'], { isTester: true })
  await bot.handleUpdate(member('kicked') as Update)
  const [row] = await db.select().from(users).where(eq(users.tgId, ME))
  assert.equal(row!.botBlocked, true)
})

test('тестовый анонс: картинка с подписью и кнопкой; не скачалась — текстом', async () => {
  const { sendAnnounce } = await import('./announce')
  const sent: { method: string; payload: Record<string, unknown> }[] = []
  let failPhoto = false
  const api = new Bot('1:test', { botInfo: { id: 1, is_bot: true, first_name: 'b', username: 'b' } as never }).api
  api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> })
    if (method === 'sendPhoto' && failPhoto) return { ok: false, error_code: 400, description: 'wrong file' } as never
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' } } } as never
  })
  const data = { tgId: 5, materialId: 7, title: 'Упражнение <1>', announce: 'Две строки', photoUrl: 'https://x/p.webp' }
  await sendAnnounce(api, pino({ level: 'silent' }), 'https://example.test', data)
  assert.equal(sent[0]!.method, 'sendPhoto')
  assert.equal(sent[0]!.payload.caption, '<b>Упражнение &lt;1&gt;</b>\n\nДве строки')
  const kb = sent[0]!.payload.reply_markup as { inline_keyboard: { web_app: { url: string } }[][] }
  assert.equal(kb.inline_keyboard[0]![0]!.web_app.url, 'https://example.test/app?m=7')
  sent.length = 0
  failPhoto = true
  await sendAnnounce(api, pino({ level: 'silent' }), 'https://example.test', data)
  assert.deepEqual(sent.map((s) => s.method), ['sendPhoto', 'sendMessage'])
})

test('«Прислать в чат»: первый раз по ссылке, потом по file_id из кеша', async () => {
  const { sendAudio } = await import('./audio')
  const store = new Map<string, string>()
  const redis = { get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: string) => (store.set(k, v), 'OK' as const) }
  const sent: unknown[] = []
  const api = new Bot('1:test', { botInfo: { id: 1, is_bot: true, first_name: 'b', username: 'b' } as never }).api
  api.config.use(async (_prev, method, payload) => {
    sent.push((payload as { audio: unknown }).audio)
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, audio: { file_id: 'FILE1', file_unique_id: 'u', duration: 1 } } } as never
  })
  const d = { tgId: 5, mediaId: 9, title: 'Дыхание', url: 'https://x/api/m/9/original?e=1&s=2' }
  await sendAudio(api, redis as never, d)
  await sendAudio(api, redis as never, d)
  assert.deepEqual(sent, [d.url, 'FILE1'])
})

test('«красное слово» в чате — экстренный текст с 103 и 112, даже без согласия (ТЗ 10.3, приёмка 20)', { skip: !url }, async () => {
  await send('у малыша температурит третий день')
  const [text] = sentTexts()
  assert.ok(text?.includes('103') && text.includes('112'), 'экстренный текст')
  assert.equal((await db.select().from(users).where(eq(users.tgId, ME))).length, 0, 'ничего не записано')
})

test('«Хочу материал на эту тему»: только тема из словаря (ТЗ 11.2)', { skip: !url }, async () => {
  await grantConsents(db, ME, ['pd'], { isTester: true })
  await press('want')
  assert.ok(buttons().some((b) => b.startsWith('want:')))
  calls = []
  await press('want:0')
  assert.deepEqual(sentTexts(), [T.searchWantThanks])
})

test('пост канала автора уходит в админку, чужие каналы игнорируются (ТЗ 9.9, приёмка 33)', async () => {
  const got: number[] = []
  const b = new Bot('1:test', { botInfo: { id: 1, is_bot: true, first_name: 'bot', username: 'test_bot' } as never })
  b.api.config.use(async () => ({ ok: true, result: true }) as never)
  setupBot(b, {
    db: undefined as never,
    log: pino({ level: 'silent' }),
    publicUrl: 'https://example.test',
    channelUrl: 'https://t.me/x',
    redis: undefined as never,
    channel: { id: -100777, onPost: async (m) => void got.push(m.message_id), onEdited: async () => undefined },
  })
  const post = (chatId: number, id: number) =>
    b.handleUpdate({ update_id: id, channel_post: { message_id: id, date: 0, chat: { id: chatId, type: 'channel', title: 'c' }, text: 'пост' } } as Update)
  await post(-100777, 11)
  await post(-100999, 12)
  assert.deepEqual(got, [11])
})

test('закрытый режим: не из списка доступа — «Бот пока в разработке», ничего не записано (приёмка 34)', { skip: !url }, async () => {
  const { appSettings } = await import('@mama/shared/db')
  const { resetSettingsCache } = await import('@mama/shared')
  await db
    .transaction(async (tx) => {
      // Включаем закрытый режим только внутри транзакции — работающий бот этого не видит.
      await tx
        .insert(appSettings)
        .values({ key: 'closedMode', value: true })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: true } })
      resetSettingsCache()
      const b = new Bot('1:test', { botInfo: { id: 1, is_bot: true, first_name: 'bot', username: 'test_bot' } as never })
      const out: string[] = []
      b.api.config.use(async (_p, method, payload) => {
        if (method === 'sendMessage') out.push(String((payload as { text: string }).text))
        return { ok: true, result: { message_id: 1, date: 0, chat, text: '' } } as never
      })
      const counters = { incr: async () => 1, expire: async () => 1 }
      setupBot(b, { db: tx as never, log: pino({ level: 'silent' }), publicUrl: 'https://example.test', channelUrl: 'https://t.me/x', redis: counters as never })
      await b.handleUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat, from, text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }] } } as Update)
      assert.equal(out.length, 1)
      assert.ok(out[0]!.startsWith('Бот пока в разработке'))
      assert.equal((await tx.select().from(users).where(eq(users.tgId, ME))).length, 0)
      tx.rollback()
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes('Rollback'))) throw e
    })
  resetSettingsCache()
})
