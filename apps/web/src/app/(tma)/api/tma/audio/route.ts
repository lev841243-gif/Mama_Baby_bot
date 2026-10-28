import { bumpStat, createRedis, hashTgId } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canOpen, getMaterial } from '@/lib/content'
import { publicUrl, signedMediaPath } from '@/lib/media-url'
import { getBotQueue, getDb, log, tmaRoute } from '@/lib/server'

export const dynamic = 'force-dynamic'

const input = z.object({ id: z.number().int().positive(), action: z.enum(['listen', 'send']) })

let redis: ReturnType<typeof createRedis> | undefined

/**
 * Аудио материала (ТЗ 8.4): «listen» — обезличенный счётчик прослушиваний (ТЗ 11.2),
 * «send» — «Прислать в чат»: бот присылает файл. Закрытое аудио без подписки не уходит (приёмка 16).
 */
export const POST = tmaRoute(async ({ tgId, req }) => {
  const body = input.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { id, action } = body.data
  const found = await getMaterial(id)
  const audio = found.status === 'ok' ? (found.doc.audio as { id: number; mimeType?: string } | null) : null
  if (found.status !== 'ok' || !audio?.mimeType?.startsWith('audio/') || !(await canOpen(found.doc, tgId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (action === 'listen') {
    await bumpStat(getDb(), id, 'listen')
    return NextResponse.json({ ok: true })
  }
  // Не чаще раза в 10 секунд с одного аккаунта: двойное нажатие не шлёт два файла.
  redis ??= createRedis()
  const fresh = await redis.set(`send-audio:${hashTgId(tgId)}`, '1', 'EX', 10, 'NX')
  if (!fresh) return NextResponse.json({ ok: true, throttled: true })
  await getBotQueue().add(
    'send-audio',
    { tgId, mediaId: audio.id, title: String(found.doc.title ?? ''), url: publicUrl() + signedMediaPath(audio.id, 'original') },
    { removeOnComplete: true, removeOnFail: 100 },
  )
  log.info({ user: hashTgId(tgId), material: id }, 'audio sent to chat')
  return NextResponse.json({ ok: true })
})
