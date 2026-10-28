// Интеграционные тесты на настоящем Postgres (схема app уже мигрирована).
// Запуск: TEST_DATABASE_URL=postgres://…localhost:55432/… corepack pnpm -F @mama/shared test
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { eq, inArray, sql } from 'drizzle-orm'
import { deleteUserData, getConsentState, grantConsents, revokeConsent } from './consents'
import { createDb, type Db } from './db/client'
import { consents, feedSent, feedSettings, payments, skillCalendar, users } from './db/schema'
import { getChildBirth, setBotBlocked, setChildBirth } from './profile'
import { runFeedTick, subscribeFeed, type FeedSender } from './feed'
import {
  addCalendarEntry,
  clearCalendar,
  deleteCalendarEntry,
  disableCalendar,
  enableCalendar,
  listCalendar,
  listSkills,
  updateCalendarEntry,
} from './calendar'
import { resetSettingsCache, setAppSettings } from './settings'
import { runInactiveCleanup } from './inactive'

const url = process.env.TEST_DATABASE_URL
// Отрицательные ID в Telegram не бывают — тестовые записи не пересекутся с настоящими.
const A = -1001
const B = -1002
let db: Db

const cleanup = async () => {
  await db.delete(users).where(inArray(users.tgId, [A, B]))
  await db.delete(payments).where(eq(payments.provider, 'test'))
}

before(async () => {
  if (!url) return
  db = createDb(url, 2)
  await cleanup()
})

after(async () => {
  if (!url) return
  await cleanup()
  await db.$client.end()
})

test('без основного согласия ничего не записывается', { skip: !url }, async () => {
  await assert.rejects(grantConsents(db, A, ['feed'], { isTester: true }))
  const rows = await db.select().from(users).where(eq(users.tgId, A))
  assert.equal(rows.length, 0)
})

test('«Принять всё» пишет только показанные пункты, каждое согласие — отдельной записью', { skip: !url }, async () => {
  const state = await grantConsents(db, A, ['pd', 'feed', 'calendar', 'ads'], { isTester: true })
  assert.equal(state.pdValid, true)
  assert.deepEqual(Object.keys(state.granted).sort(), ['feed', 'pd'])
  // Повторное принятие той же версии не плодит записей.
  await grantConsents(db, A, ['pd'], { isTester: true })
  const rows = await db.select().from(consents).where(eq(consents.userId, state.userId!))
  assert.equal(rows.length, 2)
})

test('снятие галочки ленты отзывает только ленту и чистит её данные', { skip: !url }, async () => {
  const { userId } = await getConsentState(db, A)
  await db.insert(feedSent).values({ userId: userId!, materialId: 1 })
  await db.insert(feedSettings).values({ userId: userId!, slot: 'morning' })
  assert.equal(await revokeConsent(db, A, 'feed'), 'revoked')
  assert.equal((await db.select().from(feedSettings).where(eq(feedSettings.userId, userId!))).length, 0)
  const state = await getConsentState(db, A)
  assert.equal(state.pdValid, true)
  assert.equal(state.granted.feed, undefined)
  assert.equal((await db.select().from(feedSent).where(eq(feedSent.userId, userId!))).length, 0)
})

test('полный отзыв удаляет всё, кроме записей об оплате (ТЗ 11.5)', { skip: !url }, async () => {
  await grantConsents(db, B, ['pd', 'feed'], { isTester: false })
  await setChildBirth(db, B, { year: new Date().getFullYear(), month: 1 })
  assert.ok(await getChildBirth(db, B))
  const { userId } = await getConsentState(db, B)
  await db.insert(payments).values({
    userId: userId!,
    provider: 'test',
    providerPaymentId: `test-${Date.now()}`,
    amount: 100,
    currency: 'XTR',
    status: 'paid',
  })

  assert.equal(await revokeConsent(db, B, 'pd'), 'deleted')
  assert.equal((await db.select().from(users).where(eq(users.tgId, B))).length, 0)
  assert.equal((await db.select().from(consents).where(eq(consents.userId, userId!))).length, 0)
  const [payment] = await db.select().from(payments).where(eq(payments.provider, 'test'))
  assert.ok(payment, 'запись об оплате осталась')
  assert.equal(payment.userId, null)

  // Повторный вход — с нуля, как у нового человека.
  const fresh = await getConsentState(db, B)
  assert.equal(fresh.userId, null)
  assert.equal(await deleteUserData(db, B), false)
})

test('«Удалить данные тестировщиков» удаляет только тестировщиков (приёмка 36)', { skip: !url }, async () => {
  const { deleteTesters } = await import('./admin')
  // В транзакции с откатом: в базе разработки есть настоящие тестировщики, их не трогаем.
  await db
    .transaction(async (tx) => {
      const t = tx as unknown as Db
      await grantConsents(t, A, ['pd'], { isTester: true })
      await grantConsents(t, B, ['pd'], { isTester: false })
      assert.ok((await deleteTesters(t)) >= 1)
      assert.equal((await t.select().from(users).where(eq(users.tgId, A))).length, 0)
      assert.equal((await t.select().from(users).where(eq(users.tgId, B))).length, 1)
      tx.rollback()
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes('Rollback'))) throw e
    })
})

test('тексты из админки подменяют значения по умолчанию, пустое поле — по умолчанию', { skip: !url }, async () => {
  const { T, getTexts, resetSettingsCache } = await import('./settings')
  const { DEFAULT_TEXTS } = await import('./texts')
  const { appSettings } = await import('./db/schema')
  const [before] = await db.select().from(appSettings).where(eq(appSettings.key, 'texts'))
  await db
    .transaction(async (tx) => {
      const t = tx as unknown as Db
      await t
        .insert(appSettings)
        .values({ key: 'texts', value: { mainMenu: 'Меню автора', help: '  ' } })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: { mainMenu: 'Меню автора', help: '  ' } } })
      resetSettingsCache()
      const texts = await getTexts(t)
      assert.equal(texts.mainMenu, 'Меню автора')
      assert.equal(T.mainMenu, 'Меню автора', 'живой объект T обновился')
      assert.equal(texts.help, DEFAULT_TEXTS.help)
      tx.rollback()
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message.includes('Rollback'))) throw e
    })
  resetSettingsCache()
  await getTexts(db)
  assert.equal(T.mainMenu, (before?.value as Record<string, string> | undefined)?.mainMenu || DEFAULT_TEXTS.mainMenu)
})

test('оплата идемпотентна: повтор того же платежа не продлевает дважды (приёмка 17)', { skip: !url }, async () => {
  const { processPayment, getActiveSubscriptionUntil, getSubscription } = await import('./subscription')
  await db.delete(users).where(eq(users.tgId, A))
  await grantConsents(db, A, ['pd'], { isTester: true })
  const plan = { id: 'month', title: '1 месяц', periodDays: 30, priceRub: 0, priceStars: 0 }
  const now = new Date('2026-11-01T10:00:00Z')
  const pay = { provider: 'test', providerPaymentId: `test-idem-${Date.now()}`, tgId: A, plan, amount: 0, currency: 'RUB' }
  const first = await processPayment(db, pay, now)
  const again = await processPayment(db, pay, now)
  assert.equal(first.status, 'applied')
  assert.equal(again.status, 'duplicate')
  assert.equal(again.endsAt?.getTime(), first.endsAt?.getTime())
  assert.equal((await db.select().from(payments).where(eq(payments.providerPaymentId, pay.providerPaymentId))).length, 1)
  // Продление — от конца текущего срока.
  const second = await processPayment(db, { ...pay, providerPaymentId: `${pay.providerPaymentId}-2` }, now)
  assert.equal(second.endsAt!.getTime() - now.getTime(), 60 * 24 * 3600 * 1000)
  assert.ok(await getActiveSubscriptionUntil(db, A, now))
  // По окончании срока доступ закрывается сам (приёмка 18).
  assert.equal(await getActiveSubscriptionUntil(db, A, new Date(now.getTime() + 61 * 24 * 3600 * 1000)), null)
  assert.equal((await getSubscription(db, A, now))?.plan, 'month')
  await db.delete(payments).where(eq(payments.providerPaymentId, pay.providerPaymentId))
  await db.delete(payments).where(eq(payments.providerPaymentId, `${pay.providerPaymentId}-2`))
})

test('напоминание за 3 дня приходит один раз (приёмка 18)', { skip: !url }, async () => {
  const { processPayment, dueReminders, markReminded } = await import('./subscription')
  await db.delete(users).where(eq(users.tgId, B))
  await grantConsents(db, B, ['pd'], { isTester: true })
  const plan = { id: 'week', title: 'неделя', periodDays: 7, priceRub: 0, priceStars: 0 }
  const now = new Date()
  const id = `test-remind-${Date.now()}`
  // Оплачено 5 дней назад на неделю — до конца 2 дня.
  await processPayment(db, { provider: 'test', providerPaymentId: id, tgId: B, plan, amount: 0, currency: 'RUB' }, new Date(now.getTime() - 5 * 24 * 3600 * 1000))
  const due = (await dueReminders(db, now)).filter((r) => r.tgId === B)
  assert.equal(due.length, 1)
  await markReminded(db, due[0]!.userId, now)
  assert.equal((await dueReminders(db, now)).filter((r) => r.tgId === B).length, 0)
  await db.delete(payments).where(eq(payments.providerPaymentId, id))
  await db.delete(users).where(inArray(users.tgId, [A, B]))
})

test('сводка — только числа и названия, без ID мам (ТЗ 11.3); отписка от ленты считается обезличенно', { skip: !url }, async () => {
  const { buildSummary } = await import('./summary')
  await db.delete(users).where(eq(users.tgId, A))
  await grantConsents(db, A, ['pd', 'feed'], { isTester: true })
  const before = await buildSummary(db)
  await revokeConsent(db, A, 'feed')
  const after = await buildSummary(db)
  assert.equal(after.feed.unsubscribed30, before.feed.unsubscribed30 + 1)
  assert.equal(after.feed.total, before.feed.total - 1)
  const json = JSON.stringify(after)
  assert.ok(!json.includes(String(A)), 'нет Telegram ID')
  assert.ok(!/"(tgId|userId|user_id|tg_id)"/.test(json), 'нет полей с ID')
  await db.delete(users).where(eq(users.tgId, A))
})

test('модель календаря навыков: записи удаляются отзывом календаря и вместе с мамой (ТЗ 10.4, 11.5)', { skip: !url }, async () => {
  const { skillCalendar } = await import('./db/schema')
  const state = await grantConsents(db, A, ['pd'], { isTester: true })
  await db.insert(skillCalendar).values({ userId: state.userId!, skillId: 1, day: '2026-10-01', status: 'start' })
  await revokeConsent(db, A, 'calendar')
  assert.equal((await db.select().from(skillCalendar).where(eq(skillCalendar.userId, state.userId!))).length, 0)
  await db.insert(skillCalendar).values({ userId: state.userId!, skillId: 1, day: '2026-10-01', status: 'formed' })
  await deleteUserData(db, A)
  assert.equal((await db.select().from(skillCalendar).where(eq(skillCalendar.userId, state.userId!))).length, 0)
})

test('лента: по возрасту, без закрытого, без повторов после сбоя, прощание в 18 месяцев (приёмка 16, 26–27)', { skip: !url }, async () => {
  const C = -1003
  class Rollback extends Error {}
  // Всё в одной транзакции с откатом: тестовые материалы не видны админке, чужие материалы ленты на время выключены.
  await db
    .transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db
      await tx.execute(sql`update payload.materials set in_feed = false`)
      const mat = async (title: string, from: number, to: number, order: number, access = 'free', inFeed = true) => {
        const [r] = await tx.execute<{ id: number }>(sql`
          insert into payload.materials (title, type, age_from, age_to, "order", access, in_feed, _status, announce)
          values (${title}, 'exercise', ${from}, ${to}, ${order}, ${access}, ${inFeed}, 'published', 'Анонс')
          returning id`)
        return Number(r!.id)
      }
      const m1 = await mat('Тест ленты 1', 4, 9, 1)
      await mat('Тест ленты закрытый', 3, 6, 2, 'paid')
      await mat('Тест ленты 6–9', 6, 9, 3)
      await mat('Тест ленты не в ленте', 3, 9, 4, 'free', false)
      await grantConsents(tx, C, ['pd'], { isTester: true })
      await setChildBirth(tx, C, { year: 2026, month: 6 })
      assert.equal(await subscribeFeed(tx, C, { slot: 'morning' }), 'ok')

      const got: string[] = []
      let fail = false
      const sender: FeedSender = {
        announce: async (_tg, m) => {
          if (fail) throw new Error('telegram down')
          got.push(m.title)
          return 'ok'
        },
        text: async (_tg, kind) => {
          got.push(kind)
          return 'ok'
        },
      }
      // Пн 02.11.2026 10:00 МСК: малышу 5 месяцев — первый по порядку материал, включающий 5.
      await runFeedTick(tx, sender, new Date('2026-11-02T07:00:00Z'), [C])
      await runFeedTick(tx, sender, new Date('2026-11-02T07:30:00Z'), [C])
      assert.deepEqual(got, ['Тест ленты 1'], 'один анонс в день, «не в ленте» и 6–9 не пришли')
      const { userId } = await getConsentState(tx, C)
      assert.deepEqual((await tx.select().from(feedSent).where(eq(feedSent.userId, userId!))).map((r) => r.materialId), [m1])

      // Чт: подходящих бесплатных больше нет, закрытый без подписки не уходит — лента молчит.
      await runFeedTick(tx, sender, new Date('2026-11-05T07:00:00Z'), [C])
      assert.deepEqual(got, ['Тест ленты 1'])

      // Сбой Telegram: материал отмечен до отправки и после «перезапуска» не дублируется.
      const m5 = await mat('Тест ленты 5', 3, 6, 5)
      fail = true
      const r = await runFeedTick(tx, sender, new Date('2026-11-09T07:00:00Z'), [C])
      assert.equal(r.failed, 1)
      fail = false
      await runFeedTick(tx, sender, new Date('2026-11-12T07:00:00Z'), [C])
      assert.deepEqual(got, ['Тест ленты 1'], 'после сбоя материал не пришёл второй раз')
      assert.ok((await tx.select().from(feedSent).where(eq(feedSent.userId, userId!))).some((x) => x.materialId === m5))

      // Заблокировала бот — ничего не уходит (приёмка 28).
      await setChildBirth(tx, C, { year: 2025, month: 5 })
      await setBotBlocked(tx, C, true)
      await runFeedTick(tx, sender, new Date('2026-11-16T07:00:00Z'), [C])
      assert.deepEqual(got, ['Тест ленты 1'])
      await setBotBlocked(tx, C, false)

      // 18 месяцев: прощание один раз, дальше тишина.
      await runFeedTick(tx, sender, new Date('2026-11-16T07:00:00Z'), [C])
      await runFeedTick(tx, sender, new Date('2026-11-19T07:00:00Z'), [C])
      assert.deepEqual(got, ['Тест ленты 1', 'farewell'])
      throw new Rollback()
    })
    .catch((err: unknown) => {
      if (!(err instanceof Rollback)) throw err
    })
})

test('календарь: только с согласием, удаление отдельно от согласия, выключение удаляет записи (приёмка 24)', { skip: !url }, async () => {
  const D = -1004
  const E = -1005
  class Rollback extends Error {}
  await db
    .transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db
      await setAppSettings(tx, { calendarEnabled: true })
      const skill = (await listSkills(tx))[0]!
      const today = '2026-11-02'
      await grantConsents(tx, D, ['pd'], { isTester: true })
      await grantConsents(tx, E, ['pd', 'calendar'], { isTester: true })
      await setChildBirth(tx, D, { year: 2026, month: 3 })
      const entry = { skillId: skill.id, day: '2026-10-01', status: 'start' as const }

      // Без отдельного согласия запись не пишется.
      assert.equal(await addCalendarEntry(tx, D, entry, today), 'need_consent')
      assert.equal(await enableCalendar(tx, D), true)
      assert.equal(await addCalendarEntry(tx, D, entry, today), 'ok')
      assert.equal(await addCalendarEntry(tx, D, { ...entry, day: '2026-11-03' }, today), 'bad_day', 'не в будущем')
      assert.equal(await addCalendarEntry(tx, D, { ...entry, day: '2026-02-28' }, today), 'bad_day', 'не раньше рождения')
      assert.equal(await addCalendarEntry(tx, E, entry, today), 'ok')

      // Чужую запись не удалить и не изменить.
      const [mine] = await listCalendar(tx, D)
      assert.equal(await deleteCalendarEntry(tx, E, mine!.id), false)
      assert.equal(await updateCalendarEntry(tx, E, mine!.id, { ...entry, status: 'formed' }, today), 'missing')

      // «Удалить записи» — согласие остаётся; «Выключить» — согласие отозвано, записей нет.
      assert.equal(await clearCalendar(tx, D), 1)
      assert.ok((await getConsentState(tx, D)).granted.calendar)
      await addCalendarEntry(tx, D, entry, today)
      assert.equal(await disableCalendar(tx, D), 'revoked')
      const [u] = await tx.select().from(users).where(eq(users.tgId, D))
      assert.equal((await tx.select().from(skillCalendar).where(eq(skillCalendar.userId, u!.id))).length, 0)
      assert.equal((await listCalendar(tx, E)).length, 1, 'у другой мамы всё на месте')
      throw new Rollback()
    })
    .catch((err: unknown) => {
      if (!(err instanceof Rollback)) throw err
    })
  resetSettingsCache()
})

test('Р9: неактивных сначала предупреждаем, через 2 недели удаляем; выключено — ничего; Р10: счётчик отзывов без ID', { skip: !url }, async () => {
  const F = -1006
  const G = -1007
  class Rollback extends Error {}
  await db
    .transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db
      await grantConsents(tx, F, ['pd'], { isTester: true })
      await grantConsents(tx, G, ['pd'], { isTester: true })
      const yearAgo = new Date(Date.now() - 400 * 86_400_000)
      await tx.update(users).set({ lastActiveAt: yearAgo }).where(inArray(users.tgId, [F, G]))
      await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.tgId, G))
      const warned: number[] = []
      const warn = async (id: number) => {
        warned.push(id)
        return 'ok' as const
      }
      // Флаг выключен — ничего не происходит.
      await setAppSettings(tx, { inactiveCleanup: false })
      assert.deepEqual(await runInactiveCleanup(tx, warn), { warned: 0, deleted: 0 })

      await setAppSettings(tx, { inactiveCleanup: true, inactiveMonths: 12 })
      const r1 = await runInactiveCleanup(tx, warn)
      assert.deepEqual(warned, [F], 'активную маму не трогаем')
      assert.equal(r1.deleted, 0, 'в день предупреждения не удаляем')
      // Через 2 недели — удалена; активная — на месте.
      const r2 = await runInactiveCleanup(tx, warn, new Date(Date.now() + 15 * 86_400_000))
      assert.equal(r2.deleted, 1)
      assert.equal((await tx.select().from(users).where(eq(users.tgId, F))).length, 0)
      assert.equal((await tx.select().from(users).where(eq(users.tgId, G))).length, 1)

      // Р10: отзыв ленты пишет только «тип + день + число».
      await setAppSettings(tx, { revocationLog: true })
      await grantConsents(tx, G, ['pd', 'feed'], { isTester: true })
      await revokeConsent(tx, G, 'feed')
      const rows = await tx.execute<{ kind: string; count: number }>(sql`select kind, count from app.stat_daily where kind = 'revoked:feed'`)
      assert.ok(Number(rows[0]?.count) >= 1)
      throw new Rollback()
    })
    .catch((err: unknown) => {
      if (!(err instanceof Rollback)) throw err
    })
  resetSettingsCache()
})
