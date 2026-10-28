import type { Db } from './db/client'
import { accessList } from './db/schema'
import { getSettings } from './settings'

const TTL_MS = 30_000
let cache: { at: number; ids: Set<number> } | undefined

async function loadAccessList(db: Db): Promise<Set<number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids
  const rows = await db.select({ tgId: accessList.tgId }).from(accessList)
  cache = { at: Date.now(), ids: new Set(rows.map((r) => r.tgId)) }
  return cache.ids
}

export function resetAccessCache() {
  cache = undefined
}

export type AccessDecision = { allowed: boolean; closedMode: boolean }

/**
 * Закрытый режим (ТЗ 14): пропускаем только список доступа.
 * Тем, кого нет в списке, ничего не записываем — вызывающий код только отвечает «Бот пока в разработке».
 */
export async function checkAccess(db: Db, tgId: number): Promise<AccessDecision> {
  const { closedMode } = await getSettings(db)
  if (!closedMode) return { allowed: true, closedMode }
  const ids = await loadAccessList(db)
  return { allowed: ids.has(tgId), closedMode }
}

export function parseTgIdList(raw: string | undefined): number[] {
  if (!raw) return []
  return raw
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
}

/** Начальный список доступа из env ACCESS_LIST_TG_IDS. Дальше список ведётся в админке («Список доступа»). */
export async function seedAccessList(db: Db, raw: string | undefined): Promise<number> {
  const ids = parseTgIdList(raw)
  if (ids.length === 0) return 0
  const res = await db
    .insert(accessList)
    .values(ids.map((tgId) => ({ tgId, note: 'env' })))
    .onConflictDoNothing()
    .returning({ tgId: accessList.tgId })
  cache = undefined
  return res.length
}

