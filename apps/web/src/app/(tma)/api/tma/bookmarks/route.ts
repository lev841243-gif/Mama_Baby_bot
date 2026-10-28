import { listBookmarks, listDone } from '@mama/shared'
import { NextResponse } from 'next/server'
import { cardsOut, listCards } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { BookmarksPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** Закладки (ТЗ 8.1). Материал в архиве или снятый с публикации — «Материал больше недоступен» (ТЗ 9.4). */
export const POST = tmaRoute(async ({ tgId }) => {
  const db = getDb()
  const [ids, done] = await Promise.all([listBookmarks(db, tgId), listDone(db, tgId)])
  const cards = ids.length ? await listCards({ id: { in: ids } }) : []
  const byId = new Map(cardsOut(cards, done).map((c) => [c.id, c]))
  const res: BookmarksPayload = { items: ids.map((id) => byId.get(id) ?? { id, unavailable: true as const }) }
  return NextResponse.json(res)
})
