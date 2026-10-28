import { timingSafeEqual } from 'node:crypto'

/** Вызовы worker → web (бот в канале, очередь `ai`). Секрет только из env; без него — закрыто. */
export function isInternal(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET
  const got = req.headers.get('x-internal-secret') ?? ''
  if (!secret || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}
