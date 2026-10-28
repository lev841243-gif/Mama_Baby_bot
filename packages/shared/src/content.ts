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

export type MatchItem = { id: number; leads: number[]; requires: number[] }

/**
 * Подбор «Что уже умеет малыш?» (ТЗ 8.3): упражнения, у которых все «нужно уметь» отмечены,
 * а хотя бы один навык «ведёт к» ещё нет. Не оценивает ребёнка — только фильтр по отметкам мамы.
 */
export function matchExercises<T extends MatchItem>(items: T[], known: Set<number>): T[] {
  return items.filter((e) => e.leads.length > 0 && e.requires.every((s) => known.has(s)) && e.leads.some((s) => !known.has(s)))
}

/** Ссылка на плейлист Яндекс Музыки → адрес официального виджета (Р24). Неизвестный формат — null, тогда только кнопка. */
export function yandexMusicEmbed(url: string): string | null {
  const m = /^https:\/\/music\.yandex\.(ru|com|by|kz)\/users\/([^/?#]+)\/playlists\/(\d+)/.exec(url)
  return m ? `https://music.yandex.${m[1]}/iframe/playlist/${m[2]}/${m[3]}` : null
}

/** Время чтения статьи: ~1000 знаков в минуту, минимум минута. */
export function readingMinutes(chars: number): number {
  return Math.max(1, Math.round(chars / 1000))
}
