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
