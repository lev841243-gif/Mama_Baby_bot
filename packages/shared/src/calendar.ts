import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { feedSettings, skillCalendar, users } from './db/schema'
import { getConsentState, grantOptionalConsent, revokeConsent } from './consents'
import { getChildBirth } from './profile'
import { getSettings } from './settings'
import { isValidCalendarDay, type CalendarStatus, type SkillRef } from './calendar-parse'
import { DEFAULT_TIMEZONE, localParts } from './feed-types'

export * from './calendar-parse'

// Календарь навыков (ТЗ 10.4, 11.1): навык, дата, статус — только с отдельным согласием (04)
// и только когда календарь включён в «Настройках проекта» (у мам — после решения юриста, Р23).
// Ни голоса, ни текста записи не храним (ТЗ 10.2, приёмка 22).

/** «Сегодня» по времени мамы: пояс из настроек ленты, иначе московский (ТЗ 7). */
export async function todayFor(db: Db, tgId: number, now = new Date()): Promise<string> {
  const [row] = await db
    .select({ tz: feedSettings.timezone })
    .from(feedSettings)
    .innerJoin(users, eq(users.id, feedSettings.userId))
    .where(eq(users.tgId, tgId))
    .limit(1)
  return localParts(now, row?.tz ?? DEFAULT_TIMEZONE).date
}

/** Справочник навыков для разбора и кнопок (ТЗ 9.7). Скрытые не показываются. */
export async function listSkills(db: Db): Promise<SkillRef[]> {
  const rows = await db.execute<{ id: number; name: string; synonyms: string | null }>(
    sql`select id, name, synonyms from payload.skills where coalesce(hidden, false) = false order by "order", id`,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    synonyms: (r.synonyms ?? '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean),
  }))
}

export type CalendarAccess =
  | { status: 'off' } // календарь не запущен в проекте
  | { status: 'need_consent'; userId: number }
  | { status: 'ok'; userId: number }

/** Можно ли маме вести календарь: включён в проекте + действующее согласие на календарь (приёмка 24). */
export async function calendarAccess(db: Db, tgId: number): Promise<CalendarAccess> {
  if (!(await getSettings(db)).calendarEnabled) return { status: 'off' }
  const state = await getConsentState(db, tgId)
  if (state.userId === null || !state.pdValid) throw new Error('pd consent required')
  return state.granted.calendar ? { status: 'ok', userId: state.userId } : { status: 'need_consent', userId: state.userId }
}

/** «Включить календарь» (шаблон 07 §6): отдельное согласие 04. */
export async function enableCalendar(db: Db, tgId: number): Promise<boolean> {
  if (!(await getSettings(db)).calendarEnabled) return false
  await grantOptionalConsent(db, tgId, 'calendar')
  return true
}

/** «Выключить календарь»: отзыв согласия 04 и удаление всех записей (ТЗ 10.4, 11.5). */
export function disableCalendar(db: Db, tgId: number) {
  return revokeConsent(db, tgId, 'calendar')
}

export type CalendarEntry = { id: number; skillId: number; day: string; status: CalendarStatus }

export type SaveResult = 'ok' | 'off' | 'need_consent' | 'bad_day' | 'bad_skill'

/** Запись после «Верно» (ТЗ 10.4, приёмка 21): без согласия и с неверной датой ничего не пишется. */
export async function addCalendarEntry(
  db: Db,
  tgId: number,
  e: { skillId: number; day: string; status: CalendarStatus },
  today: string,
): Promise<SaveResult> {
  const access = await calendarAccess(db, tgId)
  if (access.status !== 'ok') return access.status
  if (!isValidCalendarDay(e.day, today, await getChildBirth(db, tgId))) return 'bad_day'
  if (!(await listSkills(db)).some((s) => s.id === e.skillId)) return 'bad_skill'
  await db.insert(skillCalendar).values({ userId: access.userId, skillId: e.skillId, day: e.day, status: e.status })
  return 'ok'
}

export async function listCalendar(db: Db, tgId: number): Promise<CalendarEntry[]> {
  const access = await calendarAccess(db, tgId)
  if (access.status !== 'ok') return []
  const rows = await db
    .select({ id: skillCalendar.id, skillId: skillCalendar.skillId, day: skillCalendar.day, status: skillCalendar.status })
    .from(skillCalendar)
    .where(eq(skillCalendar.userId, access.userId))
    .orderBy(asc(skillCalendar.day), asc(skillCalendar.id))
  return rows
}

/** Правка записи: только своей и только с согласием. */
export async function updateCalendarEntry(
  db: Db,
  tgId: number,
  id: number,
  e: { skillId: number; day: string; status: CalendarStatus },
  today: string,
): Promise<SaveResult | 'missing'> {
  const access = await calendarAccess(db, tgId)
  if (access.status !== 'ok') return access.status
  if (!isValidCalendarDay(e.day, today, await getChildBirth(db, tgId))) return 'bad_day'
  if (!(await listSkills(db)).some((s) => s.id === e.skillId)) return 'bad_skill'
  const rows = await db
    .update(skillCalendar)
    .set({ ...e, updatedAt: new Date() })
    .where(and(eq(skillCalendar.id, id), eq(skillCalendar.userId, access.userId)))
    .returning({ id: skillCalendar.id })
  return rows.length ? 'ok' : 'missing'
}

export async function deleteCalendarEntry(db: Db, tgId: number, id: number): Promise<boolean> {
  const state = await getConsentState(db, tgId)
  if (state.userId === null) return false
  const rows = await db
    .delete(skillCalendar)
    .where(and(eq(skillCalendar.id, id), eq(skillCalendar.userId, state.userId)))
    .returning({ id: skillCalendar.id })
  return rows.length > 0
}

/** «Удалить записи»: все записи календаря, согласие остаётся (шаблон 07 §6, приёмка 24). */
export async function clearCalendar(db: Db, tgId: number): Promise<number> {
  const state = await getConsentState(db, tgId)
  if (state.userId === null) return 0
  const rows = await db.delete(skillCalendar).where(eq(skillCalendar.userId, state.userId)).returning({ id: skillCalendar.id })
  return rows.length
}

export type SkillMaterial = { id: number; title: string; access: 'free' | 'paid' }

/** Материалы автора по навыку после записи (ТЗ 10.4, шаг 5): упражнения, где навык в «ведёт к» или «нужно уметь». */
export async function materialsForSkill(db: Db, skillId: number, limit = 5): Promise<SkillMaterial[]> {
  const rows = await db.execute<{ id: number; title: string; access: string }>(sql`
    select m.id, m.title, m.access
    from payload.materials m
    where m._status = 'published' and coalesce(m.archived, false) = false
      and exists (
        select 1 from payload.materials_rels r
        where r.parent_id = m.id and r.skills_id = ${skillId} and r.path in ('skillsLeadsTo', 'skillsRequires')
      )
    order by m."order", m.id
    limit ${limit}`)
  return rows.map((r) => ({ id: Number(r.id), title: r.title, access: r.access === 'paid' ? 'paid' : 'free' }))
}
