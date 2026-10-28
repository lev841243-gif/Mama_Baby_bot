import {
  addCalendarEntry,
  calendarAccess,
  clearCalendar,
  deleteCalendarEntry,
  disableCalendar,
  enableCalendar,
  getChildBirth,
  hashTgId,
  listCalendar,
  listSkills,
  todayFor,
  updateCalendarEntry,
} from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, log, tmaRoute } from '@/lib/server'
import type { CalendarPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const entry = z.object({
  skillId: z.number().int().positive(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['start', 'formed']),
})
const input = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('enable') }),
    z.object({ action: z.literal('add'), entry }),
    z.object({ action: z.literal('update'), id: z.number().int().positive(), entry }),
    z.object({ action: z.literal('delete'), id: z.number().int().positive() }),
    z.object({ action: z.literal('clear') }),
    z.object({ action: z.literal('disable') }),
    // Подбор «Что уже умеет малыш?» с включённым календарём: отмеченные навыки — сегодня, «сформирован» (ТЗ 8.3).
    z.object({ action: z.literal('match'), skillIds: z.array(z.number().int().positive()).min(1).max(50) }),
  ])
  .nullable()

/** Календарь навыков в приложении (ТЗ 8.1 п. 8, 10.4): записи, правка, удаление, включение и выключение. */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const db = getDb()
  const a = body.data
  const today = await todayFor(db, tgId)
  let result: CalendarPayload['result'] = null
  if (a?.action === 'enable') {
    if (await enableCalendar(db, tgId)) log.info({ user: hashTgId(tgId) }, 'calendar enabled (app)')
  } else if (a?.action === 'add') result = await addCalendarEntry(db, tgId, a.entry, today)
  else if (a?.action === 'update') result = await updateCalendarEntry(db, tgId, a.id, a.entry, today)
  else if (a?.action === 'delete') await deleteCalendarEntry(db, tgId, a.id)
  else if (a?.action === 'clear') await clearCalendar(db, tgId)
  else if (a?.action === 'disable') {
    if ((await disableCalendar(db, tgId)) === 'revoked') log.info({ user: hashTgId(tgId) }, 'calendar disabled (app)')
  } else if (a?.action === 'match') {
    let saved = 0
    for (const skillId of [...new Set(a.skillIds)]) {
      if ((await addCalendarEntry(db, tgId, { skillId, day: today, status: 'formed' }, today)) === 'ok') saved++
    }
    result = saved > 0 ? 'ok' : 'bad_skill'
    return NextResponse.json({ ...(await state(tgId, today)), result, saved } satisfies CalendarPayload)
  }
  return NextResponse.json({ ...(await state(tgId, today)), result } satisfies CalendarPayload)
})

async function state(tgId: number, today: string): Promise<Omit<CalendarPayload, 'result'>> {
  const db = getDb()
  const access = await calendarAccess(db, tgId)
  const [skills, entries, birth] = await Promise.all([listSkills(db), listCalendar(db, tgId), getChildBirth(db, tgId)])
  return {
    enabled: access.status !== 'off',
    consent: access.status === 'ok',
    skills: skills.map(({ id, name }) => ({ id, name })),
    entries,
    birth,
    today,
  }
}
