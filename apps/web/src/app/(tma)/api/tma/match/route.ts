import { ageInMonths, ageSection, getChildBirth, listDone } from '@mama/shared'
import { NextResponse } from 'next/server'
import { cardsOut, getPayloadClient, listCards } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { MatchPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const relIds = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x : (x as { id: number }).id)) : [])

/**
 * Данные для подбора «Что уже умеет малыш?» (ТЗ 8.3): справочник навыков и упражнения со связями.
 * Подбор идёт в приложении — отметки мамы на сервер не отправляются и нигде не сохраняются (ТЗ 11.4).
 */
export const POST = tmaRoute(async ({ tgId }) => {
  const db = getDb()
  const payload = await getPayloadClient()
  const [skills, cards, done, birth] = await Promise.all([
    payload.find({ collection: 'skills', where: { hidden: { not_equals: true } }, sort: 'order', limit: 200, pagination: false, depth: 0, overrideAccess: true }),
    listCards({ type: { equals: 'exercise' } }),
    listDone(db, tgId),
    getChildBirth(db, tgId),
  ])
  const out = cardsOut(cards, done)
  const res: MatchPayload = {
    skills: skills.docs.map((s) => ({ id: s.id as number, name: String(s.name) })),
    exercises: cards.map((c, i) => ({ ...out[i]!, leads: relIds(c.skillsLeadsTo), requires: relIds(c.skillsRequires) })),
    yourSection: birth ? ageSection(ageInMonths(birth.year, birth.month)) : null,
  }
  return NextResponse.json(res)
})
