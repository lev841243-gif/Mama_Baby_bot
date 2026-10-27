import { deleteUserData, hashTgId } from '@mama/shared'
import { NextResponse } from 'next/server'
import { getDb, log, tmaRoute } from '@/lib/server'
import { notifyDataDeleted } from './notify'

export const dynamic = 'force-dynamic'

/** «Отозвать согласие» в настройках приложения: то же, что /revoke в боте (ТЗ 6.5, 8.1). */
export const POST = tmaRoute(
  async ({ tgId }) => {
    const deleted = await deleteUserData(getDb(), tgId)
    if (deleted) {
      log.info({ user: hashTgId(tgId) }, 'user data deleted (app)')
      await notifyDataDeleted(tgId)
    }
    return NextResponse.json({ status: 'deleted' })
  },
  { requireConsent: false },
)
