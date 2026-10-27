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
