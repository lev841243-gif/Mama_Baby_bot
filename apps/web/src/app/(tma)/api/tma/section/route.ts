import { AGE_SECTIONS, getSettings, listDone } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cardsOut, inSection, listCards, sectionInfo } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { SectionPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const input = z.object({ id: z.enum(AGE_SECTIONS.map((s) => s.id) as [string, ...string[]]) })

/** Раздел возраста (ТЗ 8.1): вкладки «Упражнения» и «Статьи», замок у закрытых. Материал — во всех пересекающихся разделах (ТЗ 5). */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const db = getDb()
  const [cards, settings, done] = await Promise.all([listCards(), getSettings(db), listDone(db, tgId)])
  const id = body.data.id as SectionPayload['section']['id']
  const own = cards.filter((c) => inSection(c, id))
  const res: SectionPayload = {
    section: sectionInfo(cards, settings).find((s) => s.id === id)!,
    exercises: cardsOut(own.filter((c) => c.type === 'exercise'), done),
    articles: cardsOut(own.filter((c) => c.type === 'article'), done),
  }
  return NextResponse.json(res)
})
