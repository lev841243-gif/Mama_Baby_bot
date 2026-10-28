import { childBirthInput, isValidBirth, setChildBirth } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

const input = z.object({ birth: childBirthInput.nullable() })

/** Возраст малыша в настройках приложения (ТЗ 6.3, 8.1): месяц и год, только по желанию. */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success || (body.data.birth && !isValidBirth(body.data.birth.year, body.data.birth.month))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  await setChildBirth(getDb(), tgId, body.data.birth)
  return NextResponse.json({ birth: body.data.birth })
})
