import 'server-only'
import config from '@payload-config'
import { AGE_SECTIONS, type AgeSectionId, type AppSettings, getActiveSubscriptionUntil, sectionsForRange } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { getPayload, type Where } from 'payload'
import { type MaterialCard, toCard } from './material-view'

// Материалы для мамы: только опубликованные и не в архиве (ТЗ 9.4). Без кеша — правка автора видна сразу (ТЗ 9.4: ≤ 5 мин).

export const PUBLISHED: Where = { and: [{ _status: { equals: 'published' } }, { archived: { not_equals: true } }] }

const CARD_SELECT = {
  title: true,
  type: true,
  access: true,
  cover: true,
  tags: true,
  minutes: true,
  ageFrom: true,
  ageTo: true,
  announce: true,
  order: true,
  publishedAt: true,
  skillsLeadsTo: true,
  skillsRequires: true,
} as const

export async function getPayloadClient() {
  return getPayload({ config })
}

export type CardDoc = Record<string, unknown> & { id: number; order?: number; publishedAt?: string }

/** Карточки опубликованных материалов (без текста и шагов). */
export async function listCards(where?: Where, sort = 'order'): Promise<CardDoc[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'materials',
    where: where ? { and: [PUBLISHED, where] } : PUBLISHED,
    sort,
    limit: 1000,
    pagination: false,
    depth: 1,
    select: CARD_SELECT,
    overrideAccess: true,
  })
  return res.docs as unknown as CardDoc[]
}

export type MaterialLookup =
  | { status: 'ok'; doc: Record<string, unknown> & { id: number } }
  | { status: 'archived' | 'missing' }

/** Полный материал. Черновик и удалённый — «не найден», архив — «больше недоступен» (ТЗ 9.4). */
export async function getMaterial(id: number): Promise<MaterialLookup> {
  if (!Number.isSafeInteger(id)) return { status: 'missing' }
  const payload = await getPayloadClient()
  const doc = await payload.findByID({ collection: 'materials', id, depth: 2, overrideAccess: true, disableErrors: true })
  if (!doc || doc._status !== 'published') return { status: 'missing' }
  if (doc.archived) return { status: 'archived' }
  return { status: 'ok', doc: doc as unknown as Record<string, unknown> & { id: number } }
}

/** Доступ к материалу проверяется на сервере (ТЗ 8.6, приёмка 16). */
export async function canOpen(doc: Record<string, unknown>, tgId: number): Promise<boolean> {
  if (doc.access !== 'paid') return true
  const until = await getActiveSubscriptionUntil(getDb(), tgId)
  return Boolean(until && until > new Date())
}

export type SectionInfo = { id: AgeSectionId; from: number; to: number; count: number; visible: boolean }

/** Разделы по возрасту; Р11: раздел меньше N материалов скрыт, пока его не наполнят. */
export function sectionInfo(cards: CardDoc[], settings: AppSettings): SectionInfo[] {
  return AGE_SECTIONS.map((s) => {
    const count = cards.filter(
      (c) => typeof c.ageFrom === 'number' && typeof c.ageTo === 'number' && sectionsForRange(c.ageFrom, c.ageTo).includes(s.id),
    ).length
    return { id: s.id, from: s.from, to: s.to, count, visible: count > 0 && (!settings.hideSmallSections || count >= settings.smallSectionMin) }
  })
}

export function inSection(c: CardDoc, section: AgeSectionId): boolean {
  return typeof c.ageFrom === 'number' && typeof c.ageTo === 'number' && sectionsForRange(c.ageFrom, c.ageTo).includes(section)
}

export function cardsOut(docs: CardDoc[], done?: Set<number>): (MaterialCard & { done?: boolean })[] {
  return docs.map((d) => ({ ...toCard(d), ...(done?.has(d.id) ? { done: true } : {}) }))
}

/** Следующее упражнение раздела после выполненного: дальше по порядку, ещё не выполненное (ТЗ 8.2). */
export function nextExercise(cards: CardDoc[], section: AgeSectionId, currentId: number, done: Set<number>): CardDoc | null {
  const list = cards.filter((c) => c.type === 'exercise' && inSection(c, section))
  const i = list.findIndex((c) => c.id === currentId)
  const ordered = i >= 0 ? [...list.slice(i + 1), ...list.slice(0, i)] : list
  return ordered.find((c) => c.id !== currentId && !done.has(c.id)) ?? null
}
