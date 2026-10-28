import { QUEUE_BOT, createRedis } from '@mama/shared'
import { Queue } from 'bullmq'
import type { Endpoint } from 'payload'
import { isVerifiedAdmin } from '../../lib/admin-verified'
import { type MediaDoc, publicUrl, signedMediaPath } from '../../lib/media-url'

let queue: Queue | undefined

/** «Отправить анонс себе» (ТЗ 9.4): анонс черновика уходит в бот на Telegram ID из профиля админки. */
export const testAnnounceEndpoint: Endpoint = {
  path: '/:id/test-announce',
  method: 'post',
  handler: async (req) => {
    if (!(await isVerifiedAdmin(req))) return Response.json({ error: 'Нужен вход в админку' }, { status: 401 })
    const tgId = (req.user as { tgId?: number | null }).tgId
    if (!tgId) {
      return Response.json({ error: 'Укажите свой Telegram ID в профиле админки' }, { status: 400 })
    }
    const id = Number(req.routeParams?.id)
    const doc = await req.payload.findByID({ collection: 'materials', id, draft: true, depth: 1, req, disableErrors: true })
    if (!doc) return Response.json({ error: 'Материал не найден' }, { status: 404 })
    const cover = doc.cover as MediaDoc | null
    const photo = cover?.mimeType?.startsWith('image/') ? cover : null
    queue ??= new Queue(QUEUE_BOT, { connection: createRedis() })
    await queue.add(
      'test-announce',
      {
        tgId,
        materialId: id,
        title: String(doc.title ?? ''),
        announce: String(doc.announce ?? ''),
        photoUrl: photo ? publicUrl() + signedMediaPath(photo.id, photo.sizes?.card?.filename ? 'card' : 'original') : undefined,
      },
      { removeOnComplete: true, removeOnFail: 100 },
    )
    return Response.json({ ok: true })
  },
}
