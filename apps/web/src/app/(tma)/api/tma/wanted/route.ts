import { bumpWantedTopic } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

const input = z.object({ topic: z.string().min(1).max(100) })

/** «Хочу материал на эту тему»: счётчик «тема + дата», без запроса и без мамы (ТЗ 11.2, Р2). */
export const POST = tmaRoute(async ({ req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success || !(await bumpWantedTopic(getDb(), body.data.topic))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
})
