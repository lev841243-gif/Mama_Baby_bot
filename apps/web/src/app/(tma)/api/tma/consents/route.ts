import { grantConsents, grantConsentsInput, hashTgId } from '@mama/shared'
import { NextResponse } from 'next/server'
import { buildSession, getBotQueue, getConsentState, getDb, log, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

/**
 * Окно согласий: «Принять всё» или «Продолжить с выбранными» (ТЗ 8.9).
 * Без основного согласия запрос отклоняется и ничего не записывается.
 */
export const POST = tmaRoute(async ({ tgId, isTester, req }) => {
  const body = grantConsentsInput.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'pd_required' }, { status: 400 })

  const db = getDb()
  const before = await getConsentState(db, tgId)
  const state = await grantConsents(db, tgId, body.data.types, { isTester })

  if (!before.pdValid && state.pdValid) {
    log.info({ user: hashTgId(tgId), types: Object.keys(state.granted) }, 'consent granted')
    // Сообщение в чат не критично: согласие уже записано, поэтому сбой очереди не ломает ответ.
    await getBotQueue()
      .add('consent-granted', { tgId }, { removeOnComplete: true, removeOnFail: 100 })
      .catch((err: unknown) => log.error({ err, user: hashTgId(tgId) }, 'enqueue consent-granted failed'))
  }
  return NextResponse.json(await buildSession(state))
}, { requireConsent: false })
