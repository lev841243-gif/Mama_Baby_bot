import { fromBotMessage, groupPlanSchema } from '@mama/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assemble, enqueueGrouping, pendingBlocks, savePost } from '@/lib/channel'
import { getPayloadClient } from '@/lib/content'
import { isInternal } from '@/lib/internal-auth'
import { log } from '@/lib/server'

export const dynamic = 'force-dynamic'

const postInput = z.object({
  message: z.record(z.string(), z.unknown()),
  mediaGroupId: z.string().optional(),
  images: z.array(z.object({ base64: z.string(), mimeType: z.string(), name: z.string() })).max(10),
})
const editedInput = z.object({ postId: z.number().int(), text: z.string() })
const pendingInput = z.object({ postIds: z.array(z.number().int()).nullable() })
const assembleInput = z.object({ plan: z.object({ articles: z.array(groupPlanSchema.shape.articles.element) }), notes: z.array(z.string()) })

/**
 * Внутренние вызовы worker → web (секрет INTERNAL_SECRET):
 * post — новый пост канала от бота-админа («Входящие из канала», приёмка 33);
 * edited — автор поправил пост («пост изменён»); pending — блоки для ИИ; assemble — план ИИ → черновики.
 */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!isInternal(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { action } = await params
  const body = await req.json().catch(() => null)
  const payload = await getPayloadClient()

  switch (action) {
    case 'post': {
      const p = postInput.safeParse(body)
      if (!p.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      const input = fromBotMessage(p.data.message as Parameters<typeof fromBotMessage>[0])
      const images = p.data.images.map((i) => ({ buffer: Buffer.from(i.base64, 'base64'), mimeType: i.mimeType, name: i.name }))
      const res = await savePost(payload, input, images, { source: 'live', mediaGroupId: p.data.mediaGroupId })
      // Сборка — автоматически, но с паузой: части альбома приходят отдельными сообщениями.
      if (res.status !== 'skipped') await enqueueGrouping([input.postId], 'бот канала', 60_000)
      log.info({ post: input.postId, status: res.status }, 'channel post saved')
      return NextResponse.json(res)
    }
    case 'edited': {
      const p = editedInput.safeParse(body)
      if (!p.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      const found = await payload.find({ collection: 'channel-posts', where: { postId: { equals: p.data.postId } }, limit: 1, depth: 0, overrideAccess: true })
      const doc = found.docs[0]
      if (doc && String(doc.text ?? '') !== p.data.text) {
        await payload.update({ collection: 'channel-posts', id: doc.id, data: { edited: true, editedText: p.data.text }, overrideAccess: true })
      }
      return NextResponse.json({ ok: true })
    }
    case 'pending': {
      const p = pendingInput.safeParse(body)
      if (!p.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      return NextResponse.json({ blocks: await pendingBlocks(payload, p.data.postIds ?? undefined) })
    }
    case 'assemble': {
      const p = assembleInput.safeParse(body)
      if (!p.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
      const created = await assemble(payload, p.data.plan, p.data.notes)
      log.info({ drafts: created.length }, 'channel articles assembled')
      return NextResponse.json({ created })
    }
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
