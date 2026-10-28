import { getConfig, hashTgId } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { activeProvider } from '@/lib/payments'
import { getDb, log, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

const input = z.object({ planId: z.string().min(1).max(40) })

/** «Оплатить» (ТЗ 8.6): оферта принимается нажатием (шаблон 07 §7). Оплата выключена, если провайдера нет. */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { settings, subscription } = await getConfig(getDb())
  const plan = subscription.plans.find((p) => p.id === body.data.planId)
  const provider = activeProvider(settings)
  if (!plan || !provider) return NextResponse.json({ error: 'payment_disabled' }, { status: 409 })
  const result = await provider.start(tgId, plan)
  log.info({ user: hashTgId(tgId), provider: provider.id, plan: plan.id, kind: result.kind }, 'payment started')
  return NextResponse.json(result)
})
