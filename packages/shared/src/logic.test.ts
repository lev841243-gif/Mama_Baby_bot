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
