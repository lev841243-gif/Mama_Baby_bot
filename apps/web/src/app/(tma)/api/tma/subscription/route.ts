import { getConfig, getSubscription } from '@mama/shared'
import { NextResponse } from 'next/server'
import { activeProvider } from '@/lib/payments'
import { getDb, tmaRoute } from '@/lib/server'
import type { SubscriptionPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** Экран «Подписка» (ТЗ 8.1, п. 11): что входит, цена, статус и срок. */
export const POST = tmaRoute(async ({ tgId }) => {
  const db = getDb()
  const [{ settings, subscription }, sub] = await Promise.all([getConfig(db), getSubscription(db, tgId)])
  const res: SubscriptionPayload = {
    description: subscription.description,
    plans: subscription.plans.map((p) => ({ id: p.id, title: p.title, priceRub: p.priceRub, priceStars: p.priceStars })),
    status: sub ? { active: sub.active, endsAt: sub.endsAt.toISOString() } : null,
    provider: activeProvider(settings)?.id ?? null,
  }
  return NextResponse.json(res)
})
