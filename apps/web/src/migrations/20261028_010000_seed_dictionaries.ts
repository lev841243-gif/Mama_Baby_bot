import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

// Сид словарей: теги (ТЗ 9.6), навыки (ТЗ 9.7), версии согласий 0.1 (черновики шаблонов).
// Тексты бота по умолчанию лежат в коде (packages/shared/src/texts.ts) и показываются в админке как значения полей.

const TAGS = ['Сон', 'Прикорм', 'Плач', 'Развитие', 'Психология', 'Усталость мамы', 'Здоровье', 'Массаж', 'Гимнастика и упражнения', 'Ползание']

const SKILLS = [
  'Держит голову',
  'Улыбка',
  'Гуление',
  'Переворот',
  'Опора на ладони',
  'Ползание',
  'Сел',
  'Встал у опоры',
  'Первые шаги',
  'Пошёл уверенно',
  'Лепет',
  'Указательный жест',
]

const CONSENTS = ['pd', 'feed', 'calendar', 'ads'] as const

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const r = { ...req, context: { ...req.context, seed: true } }
  const tagIds = new Map<string, number>()
  for (const [i, name] of TAGS.entries()) {
    const doc = await payload.create({ collection: 'tags', data: { name, order: (i + 1) * 10 }, req: r })
    tagIds.set(name, doc.id as number)
  }
  for (const [i, name] of SKILLS.entries()) {
    // «Ползание» — и тег, и навык; они связаны (ТЗ 9.6).
    await payload.create({ collection: 'skills', data: { name, order: (i + 1) * 10, tag: tagIds.get(name) }, req: r })
  }
  for (const type of CONSENTS) {
    await payload.create({
      collection: 'consent-versions',
      data: { type, version: '0.1', significant: true, note: 'Черновик шаблона, до экспертизы юриста' },
      req: r,
    })
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'skills', where: { name: { in: SKILLS } }, req })
  await payload.delete({ collection: 'tags', where: { name: { in: TAGS } }, req })
  await payload.delete({ collection: 'consent-versions', where: { version: { equals: '0.1' } }, req })
}
