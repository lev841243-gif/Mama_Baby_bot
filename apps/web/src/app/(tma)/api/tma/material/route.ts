import { bumpStat, materialState, setLastOpened } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canOpen, getMaterial } from '@/lib/content'
import { toCard, toView } from '@/lib/material-view'
import { getDb, tmaRoute } from '@/lib/server'
import type { MaterialPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const input = z.object({ id: z.number().int().positive() })

/**
 * Материал (ТЗ 8.1–8.2). Доступ к закрытому проверяется здесь, в том числе для прямых ссылок (ТЗ 8.6):
 * без подписки отдаётся только карточка с замком — без текста, шагов и ссылок на медиа.
 */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const db = getDb()
  const id = body.data.id
  const [found, state] = await Promise.all([getMaterial(id), materialState(db, tgId, id)])
  let res: MaterialPayload
  if (found.status !== 'ok') {
    res = { status: found.status, bookmarked: state.bookmarked }
  } else if (!(await canOpen(found.doc, tgId))) {
    res = { status: 'locked', card: toCard(found.doc), bookmarked: state.bookmarked }
  } else {
    res = { status: 'ok', material: toView(found.doc), ...state }
    await Promise.all([setLastOpened(db, tgId, id), bumpStat(db, id, 'view')])
  }
  return NextResponse.json(res)
})
