import { setAppSettings } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import type { PayloadRequest } from 'payload'

/**
 * Правки автора, которые нужны и боту (worker), и приложению, кладём в app.app_settings:
 * оба процесса читают их с TTL 30 с (ТЗ 9.4: видно ≤ 5 минут без перезапуска).
 */
export async function syncAppSettings(req: PayloadRequest, entries: Record<string, unknown>) {
  // Сид в миграциях идёт до миграций схемы app (сначала Payload, потом drizzle).
  if (req.context?.seed) return
  await setAppSettings(getDb(), entries)
}
