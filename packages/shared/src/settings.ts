import type { Db } from './db/client'
import { appSettings } from './db/schema'

/** Переключатели из админки (ТЗ 14). Пока админки нет — значения по умолчанию. */
export type AppSettings = {
  /** Бот и приложение работают только для списка доступа. */
  closedMode: boolean
  /** Дисклеймер бета-версии: приветствие, /help, плашка, над окном согласий. */
  betaBanner: boolean
}

export const DEFAULT_SETTINGS: AppSettings = { closedMode: true, betaBanner: true }

// Правка в админке должна доезжать за ≤ 5 минут (ТЗ 9.4); держим 30 с.
const TTL_MS = 30_000
let cache: { at: number; value: AppSettings } | undefined

export async function getSettings(db: Db): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  const rows = await db.select().from(appSettings)
  const value = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in value) (value as Record<string, unknown>)[row.key] = row.value
  }
  cache = { at: Date.now(), value }
  return value
}

export function resetSettingsCache() {
  cache = undefined
}
