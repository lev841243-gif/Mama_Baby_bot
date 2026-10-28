import DiffMatchPatch from 'diff-match-patch'

// Подсветка текста, которого нет в исходных постах (ТЗ 3.2, 9.9, приёмка 32).
// ИИ при сборке статей только группирует текст автора; всё, что появилось не из постов
// (дописанная фраза, изменённое слово, придуманный заголовок), показывается автору.

export type Segment = { text: string; fromSource: boolean }
export type CheckedLine = { segments: Segment[]; clean: boolean }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/ё/g, 'е')

/**
 * Проверка по строкам: строка, целиком найденная в постах, чистая; иначе сравниваем её
 * с самым похожим абзацем постов и подсвечиваем вставки.
 */
export function checkAgainstSources(text: string, sources: string[]): CheckedLine[] {
  const dmp = new DiffMatchPatch()
  const pool = sources.map(norm).join('\n')
  const paragraphs = sources.flatMap((s) => s.split(/\n+/)).map((p) => p.trim()).filter(Boolean)
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (pool.includes(norm(line))) return { segments: [{ text: line, fromSource: true }], clean: true }
      let best = ''
      let bestScore = Infinity
      for (const p of paragraphs) {
        const d = dmp.diff_main(p, line)
        const score = dmp.diff_levenshtein(d)
        if (score < bestScore) {
          bestScore = score
          best = p
        }
      }
      const diffs = dmp.diff_main(best, line)
      dmp.diff_cleanupSemantic(diffs)
      const segments = diffs
        .filter(([op]) => op !== DiffMatchPatch.DIFF_DELETE)
        .map(([op, t]) => ({ text: t, fromSource: op === DiffMatchPatch.DIFF_EQUAL }))
      return { segments, clean: segments.every((s) => s.fromSource || !s.text.trim()) }
    })
}
