import { hashTgId, revokeConsent, revokeConsentInput } from '@mama/shared'
import { NextResponse } from 'next/server'
import { buildSession, getConsentState, getDb, log, tmaRoute } from '@/lib/server'
import { notifyDataDeleted } from '../../revoke/notify'

export const dynamic = 'force-dynamic'

/**
 * «Мои согласия»: снятие галочки отзывает это согласие (ТЗ 8.9). Снятие основного — полный отзыв
 * с удалением данных (ТЗ 6.5). Подтверждение мама даёт в приложении до запроса.
 * Работает и с устаревшей версией согласия: отозвать можно всегда.
 */
export const POST = tmaRoute(
  async ({ tgId, req }) => {
    const body = revokeConsentInput.safeParse(await req.json().catch(() => null))
    if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

    const db = getDb()
    const result = await revokeConsent(db, tgId, body.data.type)
    log.info({ user: hashTgId(tgId), type: body.data.type, result }, 'consent revoked')
    if (result === 'deleted') {
      await notifyDataDeleted(tgId)
      return NextResponse.json({ status: 'deleted' })
    }
    return NextResponse.json(await buildSession(await getConsentState(db, tgId)))
  },
  { requireConsent: false },
)
