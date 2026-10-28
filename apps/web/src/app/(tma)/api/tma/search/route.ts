import { createRedis, findRedWord, getRedWords, listDone, listTopics, searchMaterials, takeSearchQuota } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cardsOut, listCards } from '@/lib/content'
import { getDb, log, tmaRoute } from '@/lib/server'
import type { SearchPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const input = z.object({ q: z.string().trim().min(1).max(200) })

let redis: ReturnType<typeof createRedis> | undefined

/**
 * Поиск по словам (ТЗ 10.1). Сначала «красные слова» — до любого действия (ТЗ 10.3): тогда только
 * экстренный текст, без подбора. Текст запроса не сохраняется и не пишется в логи (ТЗ 11.4).
 */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const db = getDb()
  const { words, emergencyText } = await getRedWords(db)
  if (findRedWord(body.data.q, words)) {
    log.info('red word matched (app)')
    return NextResponse.json({ status: 'emergency', text: emergencyText } satisfies SearchPayload)
  }
  redis ??= createRedis()
  if (!(await takeSearchQuota(redis, tgId))) return NextResponse.json({ status: 'limit' } satisfies SearchPayload)

  const hits = await searchMaterials(db, body.data.q, 10)
  if (hits.length === 0) {
    return NextResponse.json({ status: 'nothing', topics: await listTopics(db) } satisfies SearchPayload)
  }
  const [cards, done] = await Promise.all([listCards({ id: { in: hits.map((h) => h.id) } }), listDone(db, tgId)])
  const byId = new Map(cardsOut(cards, done).map((c) => [c.id, c]))
  const results = hits.flatMap((h) => byId.get(h.id) ?? [])
  return NextResponse.json({ status: 'ok', results } satisfies SearchPayload)
})
