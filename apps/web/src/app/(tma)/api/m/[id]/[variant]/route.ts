import config from '@payload-config'
import { getPayload } from 'payload'
import { MEDIA_VARIANTS, type MediaDoc, type MediaVariant, verifyMediaSignature } from '@/lib/media-url'
import { openMediaFile } from '@/lib/media-store'

export const dynamic = 'force-dynamic'

/**
 * Раздача медиа по подписанной ссылке (ТЗ 8.6, 13). Подпись выдаётся только после проверки доступа
 * к материалу, поэтому сама ссылка — пропуск. Без подписи или с истёкшей — 403.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const { id: rawId, variant: rawVariant } = await params
  const url = new URL(req.url)
  const id = Number(rawId)
  const variant = rawVariant as MediaVariant
  if (!Number.isSafeInteger(id) || !MEDIA_VARIANTS.includes(variant)) return new Response(null, { status: 404 })
  if (!verifyMediaSignature(id, variant, Number(url.searchParams.get('e')), url.searchParams.get('s') ?? '')) {
    return new Response(null, { status: 403 })
  }

  const payload = await getPayload({ config })
  const doc = (await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true, disableErrors: true })) as MediaDoc | null
  if (!doc) return new Response(null, { status: 404 })
  const file = variant === 'original' ? { filename: doc.filename, mimeType: doc.mimeType } : doc.sizes?.[variant]
  if (!file?.filename) return new Response(null, { status: 404 })

  const opened = await openMediaFile(file.filename, req.headers.get('range'))
  if (!opened) return new Response(null, { status: 404 })

  const headers = new Headers({
    'content-type': file.mimeType ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    // private: ссылка подписана для конкретной выдачи, общим кешам её хранить незачем.
    'cache-control': 'private, max-age=21600, immutable',
    'x-content-type-options': 'nosniff',
  })
  if (opened.range) {
    headers.set('content-range', `bytes ${opened.range.start}-${opened.range.end}/${opened.size}`)
    headers.set('content-length', String(opened.range.end - opened.range.start + 1))
    return new Response(opened.body, { status: 206, headers })
  }
  headers.set('content-length', String(opened.size))
  return new Response(opened.body, { status: 200, headers })
}
