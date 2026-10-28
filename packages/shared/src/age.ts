// Возраст ребёнка и разделы (ТЗ 5). Без зависимостей — импортируется и в мини-приложение.
/** Возрастные разделы в полных месяцах: нижняя граница включается, верхняя нет (ТЗ 5). */
export const AGE_SECTIONS = [
  { id: '3-6', from: 3, to: 6 },
  { id: '6-9', from: 6, to: 9 },
  { id: '9-12', from: 9, to: 12 },
  { id: '12-18', from: 12, to: 18 },
] as const

export type AgeSectionId = (typeof AGE_SECTIONS)[number]['id']

/**
 * Полные месяцы по месяцу и году рождения (точную дату не спрашиваем, ТЗ 6.3).
 * Без дня рождения считаем, что месяц исполняется 1-го числа.
 */
export function ageInMonths(birthYear: number, birthMonth: number, now = new Date()): number {
  return (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth)
}

export function ageSection(months: number): AgeSectionId | null {
  return AGE_SECTIONS.find((s) => months >= s.from && months < s.to)?.id ?? null
}


/** Годы, которые можно выбрать кнопками: ребёнку не больше 18 месяцев плюс запас, не в будущем. */
export function birthYearOptions(now = new Date()): number[] {
  const y = now.getFullYear()
  return [y - 2, y - 1, y]
}

export function isValidBirth(year: number, month: number, now = new Date()): boolean {
  if (!birthYearOptions(now).includes(year) || month < 1 || month > 12) return false
  return ageInMonths(year, month, now) >= 0
}

