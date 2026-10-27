import type { Db } from './db/client'
import { appSettings } from './db/schema'

/** Переключатели проекта (ТЗ 14). Значения по умолчанию — из env, переопределяются из админки (шаг 3). */
export type AppSettings = {
  /** Бот и приложение работают только для списка доступа. */
  closedMode: boolean
  /** Дисклеймер бета-версии: приветствие, /help, плашка, над окном согласий. */
  betaBanner: boolean
  /**
   * Идёт тестирование: каждый новый пользователь помечается is_tester и удаляется кнопкой
   * «Удалить данные тестировщиков». Выключается перед бета-тестом с мамами.
   */
  testerPhase: boolean
}

const flag = (name: string, fallback: boolean) => {
  const v = process.env[name]?.trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

export function defaultSettings(): AppSettings {
  return {
    // По ТЗ 14 закрытый режим включён; Лев 28.10.2026 решил открыть бот на время разработки (CLOSED_MODE=false).
    closedMode: flag('CLOSED_MODE', true),
    betaBanner: flag('BETA_BANNER', true),
    testerPhase: flag('TESTER_PHASE', true),
  }
}

// Правка в админке должна доезжать за ≤ 5 минут (ТЗ 9.4); держим 30 с.
const TTL_MS = 30_000
let cache: { at: number; value: AppSettings } | undefined

export async function getSettings(db: Db): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  const rows = await db.select().from(appSettings)
  const value = defaultSettings()
  for (const row of rows) {
    if (row.key in value) (value as Record<string, unknown>)[row.key] = row.value
  }
  cache = { at: Date.now(), value }
  return value
}

export function resetSettingsCache() {
  cache = undefined
}
