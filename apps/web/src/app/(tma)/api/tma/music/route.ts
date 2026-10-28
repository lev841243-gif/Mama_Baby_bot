import { getSettings, yandexMusicEmbed } from '@mama/shared'
import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { MusicPayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** «Потешки и музыка» (ТЗ 8.5): плейлисты автора в Яндекс Музыке. Виджет — только если включён в настройках (Р24). */
export const POST = tmaRoute(async () => {
  const payload = await getPayloadClient()
  const [res, settings] = await Promise.all([
    payload.find({ collection: 'playlists', where: { hidden: { not_equals: true } }, sort: 'order', limit: 200, pagination: false, depth: 0, overrideAccess: true }),
    getSettings(getDb()),
  ])
  const body: MusicPayload = {
    playlists: res.docs.map((p) => ({
      id: p.id as number,
      title: String(p.title),
      description: String(p.description ?? ''),
      kind: String(p.kind ?? ''),
      url: String(p.url),
      // TODO(Р24): виджет включается флагом после проверки на iPhone и Android; иначе — кнопка-ссылка.
      embedUrl: settings.musicWidget ? yandexMusicEmbed(String(p.url)) : null,
    })),
  }
  return NextResponse.json(body)
})
