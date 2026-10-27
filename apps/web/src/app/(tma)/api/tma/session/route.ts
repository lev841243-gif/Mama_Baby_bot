import { NextResponse } from 'next/server'
import { buildSession, getConsentState, getDb, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

/** Состояние мамы при открытии приложения: нужно ли окно согласий (ТЗ 8, 8.9). Ничего не пишет. */
export const POST = tmaRoute(async ({ tgId }) => {
  const state = await getConsentState(getDb(), tgId)
  return NextResponse.json(await buildSession(state))
})
