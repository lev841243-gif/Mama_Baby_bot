import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/content'
import { tmaRoute } from '@/lib/server'
import type { UsefulPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** «Полезное» (ТЗ 8.7): только ссылки автора, без продаж внутри приложения. */
export const POST = tmaRoute(async () => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'useful-links',
    where: { hidden: { not_equals: true } },
    sort: 'order',
    limit: 200,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const body: UsefulPayload = {
    links: res.docs.map((l) => ({
      id: l.id as number,
      title: String(l.title),
      description: String(l.description ?? ''),
      kind: String(l.kind ?? ''),
      url: String(l.url),
    })),
  }
  return NextResponse.json(body)
})
