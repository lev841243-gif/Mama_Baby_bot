import { NextResponse } from 'next/server'
import { log } from '@/lib/server'

export const dynamic = 'force-dynamic'

const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined)

/**
 * Ошибки JavaScript мини-приложения (белый экран на телефоне). Без авторизации и без данных мамы:
 * только текст ошибки, файл, строка и браузер — чтобы увидеть, что ломается на устройстве.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { stage?: unknown; errors?: unknown[]; ua?: unknown } | null
  if (!body || !Array.isArray(body.errors)) return NextResponse.json({ ok: false }, { status: 400 })
  log.warn(
    {
      stage: cut(body.stage, 30),
      ua: cut(body.ua, 200),
      errors: body.errors.slice(0, 10).map((e) => cut(e, 400)),
    },
    'client error',
  )
  return NextResponse.json({ ok: true })
}
