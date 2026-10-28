import { WORKER_HEARTBEAT_KEY, createRedis, pingDb } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

let redis: ReturnType<typeof createRedis> | undefined

/**
 * Проверка для Uptime Kuma (ТЗ 13): web отвечает, база и Redis доступны, бот (worker) жив —
 * он пишет отметку в Redis раз в 30 секунд. Без подробностей наружу: только ok и что упало.
 */
export async function GET() {
  const failed: string[] = []
  try {
    await pingDb(getDb())
  } catch {
    failed.push('db')
  }
  try {
    redis ??= createRedis()
    const beat = Number(await redis.get(WORKER_HEARTBEAT_KEY))
    if (!beat || Date.now() - beat > 3 * 60 * 1000) failed.push('worker')
  } catch {
    failed.push('redis')
  }
  return NextResponse.json({ ok: failed.length === 0, failed }, { status: failed.length ? 503 : 200 })
}
