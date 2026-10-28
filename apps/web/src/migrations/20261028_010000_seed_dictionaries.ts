import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

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

// Прямой SQL, а не payload.create: Local API знает текущую схему коллекций, и на чистой базе падает на полях,
// которые добавят более поздние миграции (так было с «Как говорят мамы» у навыков). Колонки — на момент этой миграции.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [i, name] of TAGS.entries()) {
    await db.execute(sql`insert into "payload"."tags" ("name", "order") values (${name}, ${(i + 1) * 10})`)
  }
  for (const [i, name] of SKILLS.entries()) {
    // «Ползание» — и тег, и навык; они связаны (ТЗ 9.6).
    await db.execute(sql`
      insert into "payload"."skills" ("name", "order", "tag_id")
      values (${name}, ${(i + 1) * 10}, (select id from "payload"."tags" where "name" = ${name} limit 1))`)
  }
  for (const type of CONSENTS) {
    await db.execute(sql`
      insert into "payload"."consent_versions" ("type", "version", "significant", "note")
      values (${type}, '0.1', true, 'Черновик шаблона, до экспертизы юриста')`)
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'skills', where: { name: { in: SKILLS } }, req })
  await payload.delete({ collection: 'tags', where: { name: { in: TAGS } }, req })
  await payload.delete({ collection: 'consent-versions', where: { version: { equals: '0.1' } }, req })
}
