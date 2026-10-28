import { checkAgainstSources } from '@mama/shared'
import type { Endpoint } from 'payload'
import { isVerifiedAdmin } from '../../lib/admin-verified'
import { lexicalPlainText } from '../../lib/lexical-text'

/** Сверка статьи с исходными постами (ТЗ 9.9, приёмка 32). Возвращает строки с подсветкой «нет в постах». */
export const sourceCheckEndpoint: Endpoint = {
  path: '/:id/source-check',
  method: 'get',
  handler: async (req) => {
    if (!(await isVerifiedAdmin(req))) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const doc = await req.payload.findByID({ collection: 'materials', id: Number(req.routeParams?.id), draft: true, depth: 0, req, disableErrors: true })
    if (!doc) return Response.json({ error: 'not_found' }, { status: 404 })
    const postIds = ((doc.sources ?? []) as { postId?: number | null }[]).map((s) => s.postId).filter((n): n is number => typeof n === 'number')
    if (postIds.length === 0) return Response.json({ title: [], announce: [], body: [], posts: 0 })
    const posts = await req.payload.find({ collection: 'channel-posts', where: { postId: { in: postIds } }, depth: 0, limit: 100, pagination: false, req })
    const sources = posts.docs.map((p) => String(p.text ?? ''))
    return Response.json({
      title: checkAgainstSources(String(doc.title ?? ''), sources),
      announce: checkAgainstSources(String(doc.announce ?? ''), sources),
      body: checkAgainstSources(lexicalPlainText(doc.body), sources),
      posts: posts.docs.length,
    })
  },
}
