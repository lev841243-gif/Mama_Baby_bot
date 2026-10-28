import { getSettings, listDone } from '@mama/shared'
import { NextResponse } from 'next/server'
import { cardsOut, listCards } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { CalmPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** «Спокойная мама» (ТЗ 8.1, п. 6): телесные и психологические практики. Р11 — подраздел меньше N скрыт. */
export const POST = tmaRoute(async ({ tgId }) => {
  const db = getDb()
  const [cards, settings, done] = await Promise.all([listCards({ type: { in: ['body', 'psy'] } }), getSettings(db), listDone(db, tgId)])
  const shown = (type: string) => {
    const list = cards.filter((c) => c.type === type)
    return settings.hideSmallSections && list.length < settings.smallSectionMin ? [] : cardsOut(list, done)
  }
  return NextResponse.json({ body: shown('body'), psy: shown('psy') } satisfies CalmPayload)
})
