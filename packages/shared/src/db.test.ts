// Интеграционные тесты на настоящем Postgres (схема app уже мигрирована).
// Запуск: TEST_DATABASE_URL=postgres://…localhost:55432/… corepack pnpm -F @mama/shared test
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { deleteUserData, getConsentState, grantConsents, revokeConsent } from './consents'
import { createDb, type Db } from './db/client'
import { consents, feedSent, payments, users } from './db/schema'
import { getChildBirth, setChildBirth } from './profile'

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
  assert.equal(await revokeConsent(db, A, 'feed'), 'revoked')
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
