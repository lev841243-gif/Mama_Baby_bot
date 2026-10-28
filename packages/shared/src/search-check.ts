import type { Db } from './db/client'
import type { EmbedProvider } from './embed'
import { findMaterials, mergeHits, searchMaterials, semanticHits, SEMANTIC_LIMIT, SIM_MARGIN, type SearchHit, type SearchMode } from './search'
import { getSettings, setAppSettings } from './settings'
import { appSettings } from './db/schema'
import { inArray } from 'drizzle-orm'

// Тест автора «25 из 30» (ТЗ 10.1, приёмка 29): запросы автора → ожидаемые материалы в тройке.
// Запросы пишет автор — это не данные мам, их можно хранить (коллекция «Проверка поиска» в админке).
// Прогон идёт через тот же findMaterials, что и у мамы, но без лимита и без «красных слов».

export type SearchCheck = {
  id: number
  query: string
  expected: number[]
  /** Названия ожидаемых — для отчёта. */
  expectedTitles?: string[]
  /** Правильный ответ — «Такой статьи пока нет»: по таким запросам подбирается порог. */
  expectNothing: boolean
}

type Near = { id: number; title: string; sim: number }

export type SearchCheckRow = SearchCheck & {
  ok: boolean
  /** Что увидит мама. */
  results: { id: number; title: string }[]
  /** Ближайшие по смыслу без порога — для настройки. */
  near: Near[]
  /** Место и балл первого ожидаемого среди ближайших (null — не в первой десятке). */
  expectedRank: number | null
  expectedSim: number | null
}

export type SearchCheckReport = {
  at: string
  mode: SearchMode
  model: string
  threshold: number
  /** ТЗ 10.1: ожидаемый материал в тройке. */
  found: { ok: number; total: number }
  /** «Такой статьи пока нет» там, где материала нет. */
  nothing: { ok: number; total: number }
  rows: SearchCheckRow[]
  /** Что было бы при другом пороге (тот же отбор и гибрид, что у мамы). */
  thresholds: { threshold: number; found: number; nothing: number }[]
}

const KEY = 'searchCheckReport'
const PREV_KEY = 'searchCheckPrevious'

const isOk = (c: SearchCheck, results: { id: number }[]) =>
  c.expectNothing ? results.length === 0 : results.some((r) => c.expected.includes(r.id))

export async function runSearchCheck(db: Db, embed: EmbedProvider, checks: SearchCheck[]): Promise<SearchCheckReport> {
  const { searchMinSimilarity } = await getSettings(db)
  const model = embed.id === 'fake' ? 'нет сервиса векторов' : await embed.model().catch(() => 'сервис векторов не ответил')
  let mode: SearchMode = 'semantic'
  const rows: SearchCheckRow[] = []
  const sims: { near: Near[]; words: SearchHit[] }[] = []
  for (const c of checks) {
    const res = await findMaterials(db, c.query, embed)
    if (res.mode !== 'semantic') mode = res.mode
    let near: Near[] = []
    if (res.mode === 'semantic') {
      const [vector] = await embed.embed([c.query], 'query', 5000)
      near = (await semanticHits(db, vector!, 0, 10, Infinity)).map(({ id, title, sim }) => ({ id, title, sim }))
    }
    const words = res.mode === 'semantic' ? await searchMaterials(db, c.query, SEMANTIC_LIMIT, true) : []
    sims.push({ near, words })
    const idx = near.findIndex((n) => c.expected.includes(n.id))
    rows.push({
      ...c,
      ok: isOk(c, res.hits),
      results: res.hits.map(({ id, title }) => ({ id, title })),
      near,
      expectedRank: idx >= 0 ? idx + 1 : null,
      expectedSim: idx >= 0 ? near[idx]!.sim : null,
    })
  }
  const count = (pred: (r: SearchCheckRow) => boolean) => rows.filter(pred).length
  const thresholds: SearchCheckReport['thresholds'] = []
  if (mode === 'semantic') {
    for (let t = 78; t <= 92; t++) {
      const threshold = t / 100
      let found = 0
      let nothing = 0
      checks.forEach((c, i) => {
        const { near, words } = sims[i]!
        const top = near[0]?.sim ?? 0
        const sem = near.filter((n) => n.sim >= threshold && n.sim >= top - SIM_MARGIN).slice(0, SEMANTIC_LIMIT)
        const results = mergeHits(
          sem.map((n) => ({ id: n.id, title: n.title, access: 'free' as const, type: '' })),
          words,
        )
        if (isOk(c, results)) c.expectNothing ? nothing++ : found++
      })
      thresholds.push({ threshold, found, nothing })
    }
  }
  return {
    at: new Date().toISOString(),
    mode,
    model,
    threshold: searchMinSimilarity,
    found: { ok: count((r) => !r.expectNothing && r.ok), total: count((r) => !r.expectNothing) },
    nothing: { ok: count((r) => r.expectNothing && r.ok), total: count((r) => r.expectNothing) },
    rows,
    thresholds,
  }
}

/** Последний отчёт и итог прошлого — в app_settings (рядом с настройками, без данных мам). */
export async function saveSearchCheckReport(db: Db, report: SearchCheckReport) {
  const { current } = await getSearchCheckReports(db)
  await setAppSettings(db, {
    [KEY]: report,
    ...(current ? { [PREV_KEY]: { at: current.at, found: current.found, nothing: current.nothing, threshold: current.threshold } } : {}),
  })
}

export async function getSearchCheckReports(db: Db): Promise<{
  current: SearchCheckReport | null
  previous: Pick<SearchCheckReport, 'at' | 'found' | 'nothing' | 'threshold'> | null
}> {
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, [KEY, PREV_KEY]))
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null
  return { current: get(KEY) as SearchCheckReport | null, previous: get(PREV_KEY) as never }
}
