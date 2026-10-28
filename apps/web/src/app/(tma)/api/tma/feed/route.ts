import {
  getFeedState,
  hashTgId,
  pauseFeed,
  resumeFeed,
  setFeedSlot,
  setFeedTimezone,
  subscribeFeed,
  unsubscribeFeed,
  type FeedSlot,
} from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, log, tmaRoute } from '@/lib/server'
import type { FeedPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

const slot = z.enum(['morning', 'day', 'evening'] satisfies FeedSlot[])
const input = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('subscribe'), slot, timezone: z.string().max(64).optional() }),
    z.object({ action: z.literal('slot'), slot }),
    z.object({ action: z.literal('tz'), timezone: z.string().max(64) }),
    z.object({ action: z.literal('pause'), days: z.union([z.literal(7), z.literal(14), z.literal(30)]) }),
    z.object({ action: z.literal('resume') }),
    z.object({ action: z.literal('unsubscribe') }),
  ])
  .nullable()

/** Лента в приложении (ТЗ 7, 8.1): состояние и действия — подписка, время, пояс, пауза, отписка. */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const raw = await req.json().catch(() => null)
  const body = input.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const db = getDb()
  const a = body.data
  let result: FeedPayload['result'] = null
  if (a?.action === 'subscribe') {
    result = await subscribeFeed(db, tgId, { slot: a.slot, timezone: a.timezone })
    if (result === 'ok') log.info({ user: hashTgId(tgId) }, 'feed subscribed (app)')
  } else if (a?.action === 'slot') await setFeedSlot(db, tgId, a.slot)
  else if (a?.action === 'tz') await setFeedTimezone(db, tgId, a.timezone)
  else if (a?.action === 'pause') await pauseFeed(db, tgId, a.days)
  else if (a?.action === 'resume') await resumeFeed(db, tgId)
  else if (a?.action === 'unsubscribe') {
    if ((await unsubscribeFeed(db, tgId)) === 'revoked') log.info({ user: hashTgId(tgId) }, 'feed unsubscribed (app)')
  }
  const body2: FeedPayload = { state: await getFeedState(db, tgId), result }
  return NextResponse.json(body2)
})
