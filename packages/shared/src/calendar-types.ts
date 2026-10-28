// Календарь навыков: то, что нужно и мини-приложению. Без зависимостей (стеммер в браузер не тянем).

/** 15.11.2026 — для подтверждения «Записала: 15.11 — …» и списка записей. */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split('-')
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}`
}
