import { AGE_SECTIONS, type AgeSectionId, bumpStat, listDone, markDone, sectionsForRange } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canOpen, cardsOut, getMaterial, listCards, nextExercise } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { FeedbackPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const input = z.object({
  id: z.number().int().positive(),
  result: z.enum(['done', 'hard']),
  section: z.enum(AGE_SECTIONS.map((s) => s.id) as [string, ...string[]]).optional(),
})

/**
 * «Получилось» / «Пока не получается» (ТЗ 8.2) и «Выполнено» у практик. «Получилось» ставит отметку «выполнено» и предлагает
 * следующее упражнение раздела. Обезличенный счётчик пишется в обоих случаях (ТЗ 11.2).
 */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { id, result } = body.data
  const found = await getMaterial(id)
  if (found.status !== 'ok' || !['exercise', 'body', 'psy'].includes(String(found.doc.type)) || !(await canOpen(found.doc, tgId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const db = getDb()
  await bumpStat(db, id, result)
  if (result === 'hard') return NextResponse.json({ next: null } satisfies FeedbackPayload)

  await markDone(db, tgId, id)
  // Практики «Спокойной мамы» только отмечаются «выполнено» (ТЗ 8.1, п. 6), следующего не предлагаем.
  if (found.doc.type !== 'exercise') return NextResponse.json({ next: null } satisfies FeedbackPayload)
  const section =
    (body.data.section as AgeSectionId | undefined) ??
    sectionsForRange(Number(found.doc.ageFrom), Number(found.doc.ageTo))[0]
  if (!section) return NextResponse.json({ next: null } satisfies FeedbackPayload)
  const [cards, done] = await Promise.all([listCards(), listDone(db, tgId)])
  const next = nextExercise(cards, section, id, done)
  return NextResponse.json({ next: next ? cardsOut([next], done)[0]! : null } satisfies FeedbackPayload)
})
