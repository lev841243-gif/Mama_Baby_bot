import { asc, count, eq, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { accessList, users } from './db/schema'
import { resetAccessCache } from './access'

// Операции своих экранов админки (ТЗ 14). Вызываются только после проверки входа и 2FA.

export async function listAccess(db: Db) {
  return db.select().from(accessList).orderBy(asc(accessList.addedAt))
}

export async function addAccess(db: Db, tgId: number, note: string | null) {
  if (!Number.isSafeInteger(tgId) || tgId <= 0) throw new Error('invalid tg id')
  await db
    .insert(accessList)
    .values({ tgId, note: note?.slice(0, 200) || null })
    .onConflictDoUpdate({ target: accessList.tgId, set: { note: note?.slice(0, 200) || null } })
  resetAccessCache()
}

export async function removeAccess(db: Db, tgId: number) {
  await db.delete(accessList).where(eq(accessList.tgId, tgId))
  resetAccessCache()
}

export async function countTesters(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(users).where(eq(users.isTester, true))
  return row?.n ?? 0
}

/**
 * «Удалить данные тестировщиков» (ТЗ 14, приёмка 36): физически удаляет участников закрытого
 * тестирования со всеми их данными (CASCADE). Материалы, настройки автора и записи об оплате не трогает.
 */
export async function deleteTesters(db: Db): Promise<number> {
  const deleted = await db.delete(users).where(eq(users.isTester, true)).returning({ id: users.id })
  return deleted.length
}

/** Всего пользователей — агрегат без отдельных мам (ТЗ 11.3). */
export async function countUsers(db: Db): Promise<{ total: number; testers: number }> {
  const [row] = await db
    .select({ total: count(), testers: sql<number>`count(*) filter (where ${users.isTester})`.mapWith(Number) })
    .from(users)
  return { total: row?.total ?? 0, testers: row?.testers ?? 0 }
}

export async function pingDb(db: Db) {
  await db.execute(sql`select 1`)
}
