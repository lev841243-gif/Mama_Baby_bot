import { and, eq, isNull, lt, or } from 'drizzle-orm'
import type { Db } from './db/client'
import { users } from './db/schema'
import { deleteUserData } from './consents'
import { getSettings } from './settings'
import { bumpDaily } from './summary'

// TODO(Р9): удаление неактивных (ТЗ 11.5). Предложение исполнителя: через 12 месяцев без действий в боте
// и приложении — как отзыв согласия, записи об оплате остаются. Выключено, пока не решат заказчица и юрист.

const DAY = 86_400_000
/** Предупреждаем за 2 недели; удаляем не раньше чем через 13 дней после предупреждения. */
const WARN_DAYS = 14

export type InactiveResult = { warned: number; deleted: number }

/**
 * Проход раз в несколько часов. Сначала предупреждение (кому можно написать), через 2 недели — удаление.
 * Заблокировавшим бот написать нельзя — их удаляем по сроку без предупреждения.
 */
export async function runInactiveCleanup(
  db: Db,
  warn: (tgId: number) => Promise<'ok' | 'blocked'>,
  now = new Date(),
): Promise<InactiveResult> {
  const s = await getSettings(db)
  const res: InactiveResult = { warned: 0, deleted: 0 }
  if (!s.inactiveCleanup) return res
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - Math.max(1, s.inactiveMonths))
  const warnFrom = new Date(cutoff.getTime() + WARN_DAYS * DAY)

  const toWarn = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(and(lt(users.lastActiveAt, warnFrom), isNull(users.inactiveWarnedAt), eq(users.botBlocked, false)))
  for (const u of toWarn) {
    // Отметка до отправки: сбой не приведёт к повторному предупреждению.
    await db.update(users).set({ inactiveWarnedAt: now }).where(eq(users.tgId, u.tgId))
    if ((await warn(u.tgId)) === 'ok') res.warned++
  }

  const toDelete = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(
      and(
        lt(users.lastActiveAt, cutoff),
        or(eq(users.botBlocked, true), lt(users.inactiveWarnedAt, new Date(now.getTime() - (WARN_DAYS - 1) * DAY))),
      ),
    )
  for (const u of toDelete) {
    if (await deleteUserData(db, u.tgId)) {
      res.deleted++
      await bumpDaily(db, 'inactive_deleted')
    }
  }
  return res
}
