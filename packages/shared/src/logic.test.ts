import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions, isConsentVersionValid } from './consents'
import { ageInMonths, ageSection, isValidBirth } from './profile'
import { monthsLabel } from './texts'

const versions = {
  pd: { required: '1.0' },
  feed: { required: '0.1' },
  calendar: { required: '0.1' },
  ads: { required: '0.1' },
}

test('версии сравниваются по числам, а не строкам', () => {
  assert.ok(compareVersions('0.10', '0.9') > 0)
  assert.equal(compareVersions('1.0', '1'), 0)
  assert.ok(compareVersions('0.1', '1.0') < 0)
})

test('существенная версия требует повторного согласия, несущественная — нет (Р8)', () => {
  assert.equal(isConsentVersionValid('pd', '0.9', versions), false)
  assert.equal(isConsentVersionValid('pd', '1.0', versions), true)
  assert.equal(isConsentVersionValid('pd', '1.1', versions), true)
})

test('возрастные разделы: нижняя граница включается, верхняя нет (ТЗ 5)', () => {
  assert.equal(ageSection(2), null)
  assert.equal(ageSection(3), '3-6')
  assert.equal(ageSection(6), '6-9')
  assert.equal(ageSection(17), '12-18')
  assert.equal(ageSection(18), null)
})

test('возраст в полных месяцах по месяцу и году', () => {
  const now = new Date(2026, 9, 28) // 28 октября 2026
  assert.equal(ageInMonths(2026, 4, now), 6)
  assert.equal(ageInMonths(2025, 10, now), 12)
  assert.equal(isValidBirth(2026, 11, now), false, 'будущий месяц')
  assert.equal(isValidBirth(2026, 10, now), true)
  assert.equal(isValidBirth(2023, 1, now), false, 'вне кнопок')
})

test('склонение месяцев', () => {
  assert.equal(monthsLabel(1), '1 месяц')
  assert.equal(monthsLabel(3), '3 месяца')
  assert.equal(monthsLabel(11), '11 месяцев')
  assert.equal(monthsLabel(12), '12 месяцев')
  assert.equal(monthsLabel(22), '22 месяца')
})

test('каждый текст подписан для админки ровно в одной группе', async () => {
  const { DEFAULT_TEXTS, TEXT_GROUPS } = await import('./texts')
  const all = TEXT_GROUPS.flatMap((g) => Object.keys(g.texts))
  assert.equal(new Set(all).size, all.length, 'ключ в двух группах')
  assert.deepEqual([...all].sort(), Object.keys(DEFAULT_TEXTS).sort())
})

test('версии согласий из админки: первая версия и существенные (Р8)', async () => {
  const { resolveConsentVersions } = await import('./consent-types')
  const v = resolveConsentVersions([
    { type: 'pd', version: '0.1', significant: false },
    { type: 'pd', version: '0.2', significant: false },
    { type: 'feed', version: '0.1', significant: false },
    { type: 'feed', version: '1.0', significant: true },
    { type: 'feed', version: '1.1', significant: false },
  ])
  assert.deepEqual(v.pd, { current: '0.2', required: '0.1' })
  assert.deepEqual(v.feed, { current: '1.1', required: '1.0' })
  assert.deepEqual(v.ads, { current: '0.1', required: '0.1' })
})

test('материал «4–9» попадает в разделы «3–6» и «6–9» (приёмка 8)', async () => {
  const { sectionsForRange } = await import('./content')
  assert.deepEqual(sectionsForRange(4, 9), ['3-6', '6-9'])
  assert.deepEqual(sectionsForRange(6, 9), ['6-9'])
  assert.deepEqual(sectionsForRange(3, 18), ['3-6', '6-9', '9-12', '12-18'])
  assert.deepEqual(sectionsForRange(0, 3), [])
})

test('подбор: «нужно уметь» отмечено, «ведёт к» ещё нет (ТЗ 8.3)', async () => {
  const { matchExercises } = await import('./content')
  const items = [
    { id: 1, leads: [10], requires: [] }, // переворот
    { id: 2, leads: [20], requires: [10] }, // ползание после переворота
    { id: 3, leads: [10], requires: [] },
    { id: 4, leads: [], requires: [] }, // без навыков — в подбор не попадает
  ]
  assert.deepEqual(matchExercises(items, new Set()).map((e) => e.id), [1, 3])
  assert.deepEqual(matchExercises(items, new Set([10])).map((e) => e.id), [2])
  assert.deepEqual(matchExercises(items, new Set([10, 20])).map((e) => e.id), [])
})

test('ссылка Яндекс Музыки → виджет; неизвестный формат — только кнопка (Р24)', async () => {
  const { yandexMusicEmbed } = await import('./content')
  assert.equal(yandexMusicEmbed('https://music.yandex.ru/users/vera/playlists/1003'), 'https://music.yandex.ru/iframe/playlist/vera/1003')
  assert.equal(yandexMusicEmbed('https://music.yandex.ru/album/123'), null)
})

test('«красные слова»: формы, опечатки, фразы; обычные запросы не задевает (ТЗ 10.3, приёмка 20)', async () => {
  const { findRedWord, DEFAULT_RED_WORDS: W } = await import('./red-words')
  const red = [
    'у малыша температура 39',
    'ребёнок температурит второй день',
    'высокой температуры нет, но вялый',
    'темпиратура у сына',
    'начались судорги',
    'малыш не дышыт',
    'сын упал с кровати',
    'проглотил батарейку',
    'отравился чем-то',
    'рвет фонтаном',
    'посинели губы',
    'не хочу жить',
    'ЖАР у ребёнка!!!',
    'кашель с кровью',
  ]
  for (const q of red) assert.ok(findRedWord(q, W), `пропуск: ${q}`)
  const calm = ['как уложить спать', 'прикорм кашей', 'какую крупу дать', 'научить ползать', 'кроватка для малыша', 'скоро ли сядет', 'сон днём', 'плачет перед сном']
  for (const q of calm) assert.equal(findRedWord(q, W), null, `лишнее срабатывание: ${q}`)
})

test('выгрузка канала: каждый пост — в блоки или в «пропущено» (приёмка 31)', async () => {
  const { groupExport, classifyPost } = await import('./channel')
  const long = 'Малыш просыпается ночью — это нормально. '.repeat(5)
  const msgs = [
    { id: 1, type: 'service', date: 'd1' },
    { id: 2, type: 'message', date: 'd2', text: 'Доброе утро!' },
    { id: 3, type: 'message', date: 'd3', text: [{ type: 'bold', text: 'Сон днём' }, `\n${long}\n`, { type: 'bold', text: 'Сон ночью' }, `\n${long}`] },
    { id: 4, type: 'message', date: 'd4', photo: 'p1.jpg', text: '' },
    { id: 5, type: 'message', date: 'd4', photo: 'p2.jpg', text: '' },
    { id: 6, type: 'message', date: 'd6', forwarded_from: 'Другой канал', text: long },
    { id: 7, type: 'message', date: 'd7', text: `${long} #реклама` },
  ]
  const posts = groupExport(msgs)
  assert.deepEqual(posts.map((p) => p.postId), [1, 2, 3, 4, 6, 7], 'альбом 4+5 — один пост')
  const res = posts.map(classifyPost)
  assert.deepEqual(res.map((r) => r.kind), ['skip', 'skip', 'post', 'post', 'skip', 'skip'])
  const post3 = res[2] as Extract<(typeof res)[number], { kind: 'post' }>
  assert.deepEqual(post3.blocks.map((b) => b.heading), ['Сон днём', 'Сон ночью'])
  assert.equal(post3.blocks[0]!.text, long)
  assert.equal((res[3] as { carousel: boolean }).carousel, true)
})

test('сборка статьи из блоков без ИИ: в теле нет чужого текста, придуманное подсвечивается (приёмка 32)', async () => {
  const { heuristicPlan } = await import('./ai')
  const { checkAgainstSources } = await import('./source-check')
  const post = 'Ритуал перед сном\nКупание, колыбельная и тишина.\nПовторяйте каждый вечер.'
  const blocks = [{ id: 1, postId: 10, heading: 'Ритуал перед сном', text: 'Купание, колыбельная и тишина.\nПовторяйте каждый вечер.' }]
  const plan = heuristicPlan(blocks)
  assert.equal(plan.articles[0]!.title, 'Ритуал перед сном')
  const body = blocks.map((b) => `${b.heading}\n${b.text}`).join('\n')
  assert.ok(checkAgainstSources(body, [post]).every((l) => l.clean))
  assert.ok(checkAgainstSources(plan.articles[0]!.announce, [post]).every((l) => l.clean))
  const edited = checkAgainstSources('Купание, тёплая колыбельная и тишина.', [post])
  assert.equal(edited[0]!.clean, false)
  assert.ok(edited[0]!.segments.some((s) => !s.fromSource && s.text.includes('тёплая')))
})
