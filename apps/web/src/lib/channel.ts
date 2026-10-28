import { type ChannelPostInput, type GroupPlan, QUEUE_AI, type AiJob, classifyPost, createRedis, plainText } from '@mama/shared'
import { Queue } from 'bullmq'
import type { Payload, PayloadRequest } from 'payload'
import { type Block as DocBlock, blocksToLexical } from './docx-import'
import { recognizeText } from './ocr'

// Перенос постов канала в базу (ТЗ 9.9): пост → блоки или «пропущено», карусели → распознавание,
// блоки → черновики статей (группирует ИИ в очереди `ai`). В приложение ничего не попадает без автора.

export type PostImage = { buffer: Buffer; mimeType: string; name: string }

const channelUrl = () => (process.env.CHANNEL_URL ?? 'https://t.me/detimam_pro').replace(/\/$/, '')
export const postUrl = (postId: number) => `${channelUrl()}/${postId}`

let aiQueue: Queue | undefined
export function getAiQueue() {
  aiQueue ??= new Queue(QUEUE_AI, { connection: createRedis() })
  return aiQueue
}

type SaveOpts = { source: 'import' | 'live'; mediaGroupId?: string; req?: PayloadRequest }

/**
 * Сохраняет пост. Повторный импорт того же поста ничего не дублирует. Для альбома из бота
 * части приходят отдельными сообщениями: склеиваем по mediaGroupId и раскладываем заново.
 */
export async function savePost(payload: Payload, input: ChannelPostInput, images: PostImage[], opts: SaveOpts) {
  const req = opts.req
  const existing = (
    await payload.find({
      collection: 'channel-posts',
      where: opts.mediaGroupId ? { mediaGroupId: { equals: opts.mediaGroupId } } : { postId: { equals: input.postId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
  ).docs[0] as unknown as Record<string, unknown> | undefined
  if (existing && !opts.mediaGroupId) return { id: existing.id as number, status: String(existing.status), created: false }

  let merged = input
  let photoIds: number[] = []
  if (existing) {
    // Часть альбома: текст — у той части, где он есть; картинки копятся.
    const prevText = String(existing.text ?? '')
    merged = { ...input, postId: Number(existing.postId), parts: plainText(input.parts).trim() ? input.parts : [prevText] }
    photoIds = ((existing.photos as number[] | undefined) ?? []).map(Number)
    merged.photos = [...photoIds.map(String), ...input.photos]
  }

  const res = classifyPost(merged)
  const keep = res.kind === 'post'
  for (const img of keep ? images.slice(0, 10) : []) {
    const m = await payload.create({
      collection: 'media',
      data: { alt: `Пост ${merged.postId}` },
      file: { data: img.buffer, mimetype: img.mimeType, name: img.name, size: img.buffer.length },
      overrideAccess: true,
      req,
    })
    photoIds.push(m.id as number)
  }

  // Карусель без текста: распознаём картинки, блок помечаем «требует проверки».
  let blocks = res.kind === 'post' ? res.blocks.map((b) => ({ ...b, needsReview: false })) : []
  const carousel = res.kind === 'post' && res.carousel
  if (carousel) {
    const recognized: string[] = []
    for (const img of images) {
      const text = await recognizeText(img.buffer, img.mimeType).catch(() => null)
      if (text) recognized.push(text)
    }
    blocks = [...blocks, ...recognized.map((text) => ({ heading: null, text, needsReview: true }))]
    if (blocks.length === 0) blocks = [{ heading: null, text: '', needsReview: true }]
  }

  const data = {
    postId: merged.postId,
    url: postUrl(merged.postId),
    date: merged.date ? new Date(merged.date).toISOString() : undefined,
    status: res.kind === 'skip' ? 'skipped' : opts.source === 'live' ? 'inbox' : 'blocks',
    skipReason: res.kind === 'skip' ? res.reason : null,
    source: opts.source,
    mediaGroupId: opts.mediaGroupId,
    text: res.text,
    preview: (res.text.trim() || (carousel ? 'Карусель без текста' : '—')).slice(0, 80),
    carousel,
    needsReview: blocks.some((b) => b.needsReview),
    photos: photoIds,
  } as const
  const post = existing
    ? await payload.update({ collection: 'channel-posts', id: existing.id as number, data: data as never, overrideAccess: true, req })
    : await payload.create({ collection: 'channel-posts', data: data as never, overrideAccess: true, req })
  if (existing) {
    await payload.delete({ collection: 'channel-blocks', where: { and: [{ post: { equals: post.id } }, { used: { not_equals: true } }] }, overrideAccess: true, req })
  }
  for (const [order, b] of blocks.entries()) {
    await payload.create({
      collection: 'channel-blocks',
      data: { post: post.id, order, heading: b.heading, text: b.text, needsReview: b.needsReview },
      overrideAccess: true,
      req,
    })
  }
  return { id: post.id as number, status: data.status, created: !existing, blocks: blocks.length }
}

/** Блоки, ещё не собранные в статьи. Пустые (карусель без распознанного текста) ждут автора. */
export async function pendingBlocks(payload: Payload, postIds?: number[]) {
  const res = await payload.find({
    collection: 'channel-blocks',
    where: { and: [{ used: { not_equals: true } }, ...(postIds?.length ? [{ 'post.postId': { in: postIds } }] : [])] },
    sort: 'id',
    limit: 2000,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs
    .map((b) => ({ id: b.id as number, postId: Number((b.post as { postId: number }).postId), heading: (b.heading as string) || null, text: String(b.text ?? '') }))
    .filter((b) => b.text.trim() || b.heading)
}

/** Поставить группировку в очередь `ai` (ТЗ 9.9, шаг 4). Задачи одного поста склеиваются по jobId. */
export async function enqueueGrouping(postIds: number[] | null, requestedBy: string, delayMs = 0) {
  const data: AiJob['data'] & { postIds: number[] | null } = { blocks: [], requestedBy, postIds }
  await getAiQueue().add('group-blocks', data, {
    jobId: postIds?.length ? `group-${postIds.join('-')}` : undefined,
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: 100,
  })
}

/** Блок поста → блоки разметки статьи: подзаголовок h2, абзацы как есть. */
function toDocBlocks(b: { heading: string | null; text: string }): DocBlock[] {
  const out: DocBlock[] = []
  if (b.heading) out.push({ kind: 'h', level: 2, inlines: [{ text: b.heading }] })
  for (const p of b.text.split(/\n+/)) if (p.trim()) out.push({ kind: 'p', inlines: [{ text: p.trim() }] })
  return out
}

/**
 * План ИИ → черновики статей. Тело — только блоки постов дословно; заголовок и анонс от ИИ
 * подсвечиваются проверкой «нет в постах» (ТЗ 9.9, приёмка 32). У статьи — ссылки на посты.
 */
export async function assemble(payload: Payload, plan: GroupPlan, notes: string[]) {
  const created: number[] = []
  for (const a of plan.articles) {
    const blocks = (
      await payload.find({
        collection: 'channel-blocks',
        where: { and: [{ id: { in: a.blockIds } }, { used: { not_equals: true } }] },
        depth: 1,
        limit: 200,
        pagination: false,
        overrideAccess: true,
      })
    ).docs
    if (blocks.length === 0) continue
    const ordered = a.blockIds.map((id) => blocks.find((b) => b.id === id)).filter(Boolean) as typeof blocks
    const posts = [...new Map(ordered.map((b) => [Number((b.post as { postId: number }).postId), b.post as { id: number; postId: number }])).values()]
    const body = blocksToLexical(
      ordered.flatMap((b) => toDocBlocks({ heading: (b.heading as string) || null, text: String(b.text ?? '') })),
      [],
    )
    const material = await payload.create({
      collection: 'materials',
      draft: true,
      overrideAccess: true,
      data: {
        _status: 'draft',
        title: a.title,
        type: 'article',
        body,
        announce: a.announce,
        access: 'free',
        order: 100,
        sources: posts.map((p) => ({ url: postUrl(p.postId), postId: p.postId })),
        importNotes: [
          'Собрано из постов канала. Справа — проверка: подсвечен текст, которого нет в постах.',
          'Канал публичный — закрывать подпиской стоит то, чего в нём нет (Р22).',
          ...notes,
          ...(ordered.some((b) => b.needsReview) ? ['Есть текст, распознанный с картинок, — сверьте с оригиналом.'] : []),
        ].join('\n'),
      } as never,
    })
    created.push(material.id as number)
    for (const b of ordered) {
      await payload.update({ collection: 'channel-blocks', id: b.id, data: { used: true, material: material.id }, overrideAccess: true })
    }
    // Новые посты остаются во «Входящих», пока автор не опубликует статью (хук материала).
    for (const p of posts) {
      if ((p as { status?: string }).status !== 'inbox') {
        await payload.update({ collection: 'channel-posts', id: p.id, data: { status: 'used' }, overrideAccess: true })
      }
    }
  }
  return created
}
