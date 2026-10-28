// Без зависимостей — можно импортировать в клиентский код мини-приложения.
export const CONSENT_TYPES = ['pd', 'feed', 'calendar', 'ads'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export type ConsentVersions = Record<ConsentType, { current: string; required: string }>

/**
 * Версии текстов согласий (ТЗ 6.6, Р8). `current` — версия, которую мама принимает сейчас.
 * `required` — последняя версия, отмеченная автором как существенная: кто принял более раннюю,
 * проходит согласие заново при следующем действии (приёмка 4). Несущественная правка
 * (current > required) повторного согласия не требует.
 * Здесь — значения до первой публикации в админке («Версии согласий»): черновики 0.1.
 */
export const DEFAULT_CONSENT_VERSIONS: ConsentVersions = {
  pd: { current: '0.1', required: '0.1' },
  feed: { current: '0.1', required: '0.1' },
  calendar: { current: '0.1', required: '0.1' },
  ads: { current: '0.1', required: '0.1' },
}

/** Сравнение версий вида «1.2.3»: <0, 0, >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Сводит опубликованные автором версии к current/required по каждому типу. */
export function resolveConsentVersions(
  rows: { type: ConsentType; version: string; significant: boolean }[],
): ConsentVersions {
  const out = structuredClone(DEFAULT_CONSENT_VERSIONS)
  for (const type of CONSENT_TYPES) {
    const own = rows.filter((r) => r.type === type)
    if (own.length === 0) continue
    const pick = (list: typeof own, sign: 1 | -1) =>
      list.reduce((a, b) => (sign * compareVersions(b.version, a.version) > 0 ? b : a)).version
    out[type].current = pick(own, 1)
    // Самая первая версия действует как существенная: до неё согласия не было вовсе.
    const first = pick(own, -1)
    const significant = own.filter((r) => r.significant)
    out[type].required = significant.length ? pick([...significant, { ...own[0]!, version: first }], 1) : first
  }
  return out
}
