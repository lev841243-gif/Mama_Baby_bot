import { type ExportMessage, groupExport } from '@mama/shared'
import { unzipSync } from 'fflate'
import { type Endpoint, addDataAndFileToRequest } from 'payload'
import { isVerifiedAdmin } from '../../lib/admin-verified'
import { type PostImage, enqueueGrouping, savePost } from '../../lib/channel'

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/**
 * Импорт выгрузки канала из Telegram Desktop (ТЗ 9.9, шаг 1): result.json или .zip всей папки
 * (тогда переносятся и картинки). Повторный импорт не дублирует посты.
 */
export const channelImportEndpoint: Endpoint = {
  path: '/import',
  method: 'post',
  handler: async (req) => {
    if (!(await isVerifiedAdmin(req))) return Response.json({ error: 'Нужен вход в админку' }, { status: 401 })
    await addDataAndFileToRequest(req)
    const file = req.file
    if (!file) return Response.json({ error: 'Нужен файл result.json или .zip выгрузки' }, { status: 400 })

    let json: { messages?: ExportMessage[] }
    const files = new Map<string, Uint8Array>()
    try {
      if (/\.zip$/i.test(file.name)) {
        const entries = unzipSync(new Uint8Array(file.data))
        const resultPath = Object.keys(entries).find((p) => /(^|\/)result\.json$/.test(p))
        if (!resultPath) return Response.json({ error: 'В архиве нет result.json' }, { status: 400 })
        const base = resultPath.slice(0, resultPath.length - 'result.json'.length)
        for (const [p, data] of Object.entries(entries)) if (p.startsWith(base)) files.set(p.slice(base.length), data)
        json = JSON.parse(new TextDecoder().decode(entries[resultPath]))
      } else {
        json = JSON.parse(file.data.toString('utf8'))
      }
    } catch {
      return Response.json({ error: 'Не получилось прочитать выгрузку. Нужен формат JSON из Telegram Desktop.' }, { status: 400 })
    }
    if (!Array.isArray(json.messages)) return Response.json({ error: 'В выгрузке нет сообщений' }, { status: 400 })

    const stats = { total: 0, created: 0, skipped: 0, posts: 0, carousels: 0 }
    for (const post of groupExport(json.messages)) {
      stats.total++
      const images: PostImage[] = post.photos.flatMap((p) => {
        const data = files.get(p)
        const ext = p.split('.').pop()?.toLowerCase() ?? ''
        return data && MIME[ext] ? [{ buffer: Buffer.from(data), mimeType: MIME[ext]!, name: p.split('/').pop()! }] : []
      })
      const res = await savePost(req.payload, post, images, { source: 'import', req })
      if (res.created) stats.created++
      if (res.status === 'skipped') stats.skipped++
      else stats.posts++
      if (post.photos.length >= 2 && res.status !== 'skipped') stats.carousels++
    }
    return Response.json(stats)
  },
}

/** «Предложить статьи»: все несобранные блоки → очередь `ai` → черновики в «Материалах». */
export const channelGroupEndpoint: Endpoint = {
  path: '/group',
  method: 'post',
  handler: async (req) => {
    if (!(await isVerifiedAdmin(req))) return Response.json({ error: 'Нужен вход в админку' }, { status: 401 })
    await enqueueGrouping(null, String((req.user as { email?: string }).email ?? 'admin'))
    return Response.json({ ok: true })
  },
}
