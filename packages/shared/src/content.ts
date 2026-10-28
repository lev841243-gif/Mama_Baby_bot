// Общее про материалы (ТЗ 9). Без зависимостей — импортируется и в админку, и в мини-приложение.
import { AGE_SECTIONS, type AgeSectionId } from './age'

export const MATERIAL_TYPES = [
  { value: 'exercise', label: 'Упражнение' },
  { value: 'article', label: 'Статья' },
  { value: 'body', label: 'Телесная практика' },
  { value: 'psy', label: 'Психологическая практика' },
] as const

export type MaterialType = (typeof MATERIAL_TYPES)[number]['value']

/** Типы с возрастом и разделами; практики «Спокойной мамы» возраста не имеют (ТЗ 9.3). */
export const AGED_TYPES: MaterialType[] = ['exercise', 'article']
export const CALM_MOM_TYPES: MaterialType[] = ['body', 'psy']

export const isAged = (t: string | null | undefined) => AGED_TYPES.includes(t as MaterialType)

/**
 * Разделы, с которыми пересекается диапазон материала [from, to) в полных месяцах (ТЗ 5):
 * «4–9» попадает в «3–6» и «6–9».
 */
export function sectionsForRange(from: number, to: number): AgeSectionId[] {
  return AGE_SECTIONS.filter((s) => from < s.to && to > s.from).map((s) => s.id)
}

/** Время чтения статьи: ~1000 знаков в минуту, минимум минута. */
export function readingMinutes(chars: number): number {
  return Math.max(1, Math.round(chars / 1000))
}
