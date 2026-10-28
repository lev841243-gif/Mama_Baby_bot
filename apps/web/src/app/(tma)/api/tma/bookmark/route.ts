import { setBookmark } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMaterial } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

const input = z.object({ id: z.number().int().positive(), on: z.boolean() })

/** «В закладки» (ТЗ 8.1). Убрать можно всегда, добавить — только существующий материал. */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (body.data.on && (await getMaterial(body.data.id)).status !== 'ok') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  await setBookmark(getDb(), tgId, body.data.id, body.data.on)
  return NextResponse.json({ bookmarked: body.data.on })
})
