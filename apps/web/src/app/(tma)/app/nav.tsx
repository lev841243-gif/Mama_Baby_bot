'use client'
import type { AgeSectionId } from '@mama/shared/age'
import { createContext, useContext } from 'react'
import type { SessionPayload } from '@/lib/session-types'

export type Screen =
  | { name: 'home' }
  | { name: 'section'; id: AgeSectionId }
  | { name: 'material'; id: number; section?: AgeSectionId }
  | { name: 'bookmarks' }
  | { name: 'calm' }
  | { name: 'match' }
  | { name: 'music' }
  | { name: 'useful' }
  | { name: 'search' }
  | { name: 'subscription' }
  | { name: 'settings' }
  | { name: 'consents' }
  | { name: 'feed' }
  | { name: 'calendar' }

export type Nav = {
  push: (s: Screen) => void
  back: () => void
  /** Заменить текущий экран (например, «следующее упражнение»). */
  replace: (s: Screen) => void
}

export type Ctx = { nav: Nav; initData: string; session: SessionPayload }

export const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('AppCtx missing')
  return ctx
}

/** Экран из ссылки: ?screen=consents|settings из бота, ?m=ID из анонса, startapp=m123 / s3-6 (ТЗ 8.8). */
export function initialStack(start: string | null): Screen[] {
  const q = new URLSearchParams(window.location.search)
  const home: Screen = { name: 'home' }
  const screen = q.get('screen')
  if (screen === 'consents') return [home, { name: 'settings' }, { name: 'consents' }]
  if (screen === 'settings') return [home, { name: 'settings' }]
  if (screen === 'feed') return [home, { name: 'settings' }, { name: 'feed' }]
  if (screen === 'calendar') return [home, { name: 'calendar' }]
  const m = Number(q.get('m') ?? (start?.startsWith('m') ? start.slice(1) : NaN))
  if (Number.isSafeInteger(m) && m > 0) return [home, { name: 'material', id: m }]
  const s = start?.startsWith('s') ? start.slice(1) : null
  if (s && ['3-6', '6-9', '9-12', '12-18'].includes(s)) return [home, { name: 'section', id: s as AgeSectionId }]
  return [home]
}
