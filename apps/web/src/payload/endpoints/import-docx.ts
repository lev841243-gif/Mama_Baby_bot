import { type Endpoint, type PayloadRequest, addDataAndFileToRequest } from 'payload'
import { isVerifiedAdmin } from '../../lib/admin-verified'
import { blocksToLexical, parseDocx } from '../../lib/docx-import'

const MAX_BYTES = 30 * 1024 * 1024

/** Имена из документа → id словаря. Чего нет в словаре — в замечания: свободный ввод тегов не допускается (ТЗ 9.6). */
async function resolveNames(req: PayloadRequest, collection: 'tags' | 'skills', names: string[], warnings: string[], what: string) {
  if (!names.length) return []
  const all = await req.payload.find({ collection, limit: 500, pagination: false, depth: 0, req })
  const byName = new Map(all.docs.map((d) => [String(d.name).toLowerCase().replace(/ё/g, 'е'), d.id as number]))
  const ids: number[] = []
  for (const n of names) {
    const id = byName.get(n.toLowerCase().replace(/ё/g, 'е'))
    if (id) ids.push(id)
    else warnings.push(`${what} «${n}» нет в словаре — выберите вручную`)
  }
  return ids
}

/**
 * Загрузка .docx из Яндекс Документов (ТЗ 9.2, 9.4): документ раскладывается по полям,
 * картинки — в «Медиа», результат — черновик. Публикует автор после проверки.
 */
export const importDocxEndpoint: Endpoint = {
  path: '/import-docx',
  method: 'post',
  handler: async (req) => {
    if (!(await isVerifiedAdmin(req))) return Response.json({ error: 'Нужен вход в админку' }, { status: 401 })
    await addDataAndFileToRequest(req)
    const file = req.file
    if (!file || !/\.docx$/i.test(file.name)) {
      return Response.json({ error: 'Нужен файл .docx' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return Response.json({ error: 'Файл больше 30 МБ' }, { status: 400 })

    let parsed
    try {
      parsed = await parseDocx(file.data)
    } catch {
      return Response.json({ error: 'Не получилось прочитать файл. Сохраните его из Яндекс Документов как .docx.' }, { status: 400 })
    }
    const warnings = [...parsed.warnings]

    // Картинки — в «Медиа» (там же уменьшаются под телефон).
    const mediaIds: (number | null)[] = []
    for (const [i, img] of parsed.images.entries()) {
      try {
        const doc = await req.payload.create({
          collection: 'media',
          data: { alt: parsed.title ? `${parsed.title} — ${i + 1}` : undefined },
          file: { data: img.buffer, mimetype: img.contentType, name: img.name, size: img.buffer.length },
          req,
        })
        mediaIds.push(doc.id as number)
      } catch {
        mediaIds.push(null)
        warnings.push(`Картинка ${i + 1} не загрузилась (формат ${img.contentType}) — добавьте вручную`)
      }
    }
    const media = (i: number | null) => (i === null ? undefined : (mediaIds[i] ?? undefined))

    const tags = (await resolveNames(req, 'tags', parsed.tags, warnings, 'Тега')).slice(0, 3)
    const skillsLeadsTo = await resolveNames(req, 'skills', parsed.skillsLeadsTo, warnings, 'Навыка')
    const skillsRequires = await resolveNames(req, 'skills', parsed.skillsRequires, warnings, 'Навыка')

    const material = await req.payload.create({
      collection: 'materials',
      draft: true,
      req,
      data: {
        _status: 'draft',
        title: parsed.title || file.name.replace(/\.docx$/i, ''),
        type: parsed.type ?? 'article',
        cover: media(parsed.cover),
        steps: parsed.steps.map((s) => ({ image: media(s.image), text: s.text })),
        body: parsed.type === 'exercise' ? undefined : blocksToLexical(parsed.body, mediaIds),
        howToKnow: parsed.howToKnow || undefined,
        ifNotWorking: parsed.ifNotWorking || undefined,
        easierVariant: parsed.easierVariant || undefined,
        whenToSeeDoctor: parsed.whenToSeeDoctor || undefined,
        ageFrom: parsed.ageFrom ?? undefined,
        ageTo: parsed.ageTo ?? undefined,
        tags,
        skillsLeadsTo,
        skillsRequires,
        minutes: parsed.minutes ?? undefined,
        minutesManual: parsed.type !== 'exercise' && parsed.minutes !== null,
        access: parsed.access ?? 'free',
        inFeed: parsed.inFeed ?? false,
        announce: parsed.announce || undefined,
        order: 100,
        importNotes: [`Импорт из «${file.name}»`, ...warnings].join('\n'),
      } as never,
    })
    return Response.json({ id: material.id, warnings })
  },
}
