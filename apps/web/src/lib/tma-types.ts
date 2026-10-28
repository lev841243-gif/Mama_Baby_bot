// Ответы API мини-приложения. Только типы — импортируются и клиентом.
import type { AgeSectionId } from '@mama/shared/age'
import type { MaterialCard, MaterialView } from './material-view'

export type Card = MaterialCard & { done?: boolean }
export type Birth = { year: number; month: number }

export type SectionInfo = { id: AgeSectionId; from: number; to: number; count: number; visible: boolean }

export type HomePayload = {
  sections: SectionInfo[]
  yourSection: AgeSectionId | null
  /** Ребёнку меньше 3 месяцев — подсказка про «Спокойную маму» (ТЗ 5). */
  tooYoung: boolean
  birth: Birth | null
  continue: Card | null
  fresh: Card[]
}

export type SectionPayload = { section: SectionInfo; exercises: Card[]; articles: Card[] }

export type MaterialPayload =
  | { status: 'ok'; material: MaterialView; bookmarked: boolean; done: boolean }
  | { status: 'locked'; card: Card; bookmarked: boolean }
  | { status: 'archived' | 'missing'; bookmarked: boolean }

export type FeedbackPayload = { next: Card | null }

export type BookmarksPayload = { items: (Card | { id: number; unavailable: true })[] }

export type CalmPayload = { body: Card[]; psy: Card[] }

export type MatchExercise = Card & { leads: number[]; requires: number[] }
export type MatchPayload = { skills: { id: number; name: string }[]; exercises: MatchExercise[]; yourSection: AgeSectionId | null }

export type Playlist = { id: number; title: string; description: string; kind: string; url: string; embedUrl: string | null }
export type MusicPayload = { playlists: Playlist[] }

export type UsefulLink = { id: number; title: string; description: string; kind: string; url: string }
export type UsefulPayload = { links: UsefulLink[] }

export type SearchPayload =
  | { status: 'ok'; results: Card[] }
  | { status: 'nothing'; topics: string[] }
  | { status: 'emergency'; text: string }
  | { status: 'limit' }

export type SubscriptionPayload = {
  description: string
  plans: { id: string; title: string; priceRub: number; priceStars: number }[]
  status: { active: boolean; endsAt: string } | null
  /** Способ оплаты; null — оплата пока выключена (Р21). */
  provider: 'test' | 'stars' | null
}
