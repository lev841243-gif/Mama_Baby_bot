import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client'
import { users } from './db/schema'
import { isValidBirth } from './age'

export * from './age'

export const childBirthInput = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export async function setChildBirth(db: Db, tgId: number, birth: { year: number; month: number } | null) {
  if (birth && !isValidBirth(birth.year, birth.month)) throw new Error('invalid birth month')
  await db
    .update(users)
    .set({ childBirthYear: birth?.year ?? null, childBirthMonth: birth?.month ?? null })
    .where(eq(users.tgId, tgId))
}

export async function getChildBirth(db: Db, tgId: number) {
  const [row] = await db
    .select({ year: users.childBirthYear, month: users.childBirthMonth })
    .from(users)
    .where(eq(users.tgId, tgId))
    .limit(1)
  return row?.year && row.month ? { year: row.year, month: row.month } : null
}

/**
 * Отметка активности для удаления неактивных (Р9): бот и приложение. Пишем не чаще раза в сутки;
 * действие после предупреждения его отменяет.
 */
export async function touchUser(db: Db, tgId: number) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await db
    .update(users)
    .set({ lastActiveAt: new Date(), inactiveWarnedAt: null })
    .where(and(eq(users.tgId, tgId), or(lt(users.lastActiveAt, dayAgo), isNotNull(users.inactiveWarnedAt))))
}

/** Мама заблокировала бот или разблокировала его (ТЗ 13): рассылка ей не идёт. */
export async function setBotBlocked(db: Db, tgId: number, blocked: boolean) {
  await db.update(users).set({ botBlocked: blocked }).where(eq(users.tgId, tgId))
}
