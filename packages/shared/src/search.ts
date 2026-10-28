import { sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { alert } from './alert'
import type { Db } from './db/client'
import { statWantedTopic } from './db/schema'
import type { EmbedProvider } from './embed'
import { hashTgId } from './log'
import { normalizeText } from './red-words'
import { getSettings } from './settings'

// Поиск по словам (ТЗ 10.1, этап 1): полнотекстовый Postgres `russian` по названию, тегам и тексту.
// Ищет только материалы автора и возвращает только их — своего текста нет (приёмка 19).
// Таблица payload.materials — схема Payload; поле search_text собирает хук материала.

export type SearchHit = { id: number; title: string; access: 'free' | 'paid'; type: string }

const MAX_WORDS = 8

async function run(db: Db, tsquery: string, limit: number): Promise<SearchHit[]> {
  const rows = await db.execute<{ id: number; title: string; access: string; type: string }>(sql`
    select id, title, access, type
    from payload.materials
    where _status = 'published'
      and coalesce(archived, false) = false
      and to_tsvector('russian', coalesce(search_text, '')) @@ to_tsquery('russian', ${tsquery})
    order by ts_rank(to_tsvector('russian', coalesce(search_text, '')), to_tsquery('russian', ${tsquery})) desc, "order" asc
    limit ${limit}
  `)
  return rows.map((r) => ({ id: Number(r.id), title: r.title, access: r.access === 'paid' ? 'paid' : 'free', type: r.type }))
}

/**
 * Сначала все слова запроса, если пусто — любое из них (strict — только все слова).
 * Слова — только буквы и цифры, поэтому tsquery безопасен.
 */
export async function searchMaterials(db: Db, query: string, limit = 10, strict = false): Promise<SearchHit[]> {
  const words = [...new Set(normalizeText(query).filter((w) => w.length >= 2))].slice(0, MAX_WORDS)
  if (words.length === 0) return []
  const terms = words.map((w) => `${w}:*`)
  const all = await run(db, terms.join(' & '), limit)
  if (all.length > 0 || words.length === 1 || strict) return all
  return run(db, terms.join(' | '), limit)
}

// Поиск по смыслу (ТЗ 10.1, этап 3): только сходство запроса с материалами автора, без генеративной модели.
// Текст запроса и его вектор живут только в этой функции: ни в базе, ни в Redis, ни в логах, ни в кеше.

/** Результат не дальше этого от лучшего: «хвост» почти одинаковых баллов у e5 — обычно шум. */
const SIM_MARGIN = 0.03
/** Сколько материалов показывать маме при поиске по смыслу (ТЗ 10.1: 1–3). */
export const SEMANTIC_LIMIT = 3
/** Вектор запроса — прямой вызов с коротким таймаутом; не успел — поиск по словам (ТЗ 13: ≤ 5 с). */
const QUERY_TIMEOUT_MS = 2000
/** Слияние рангов (reciprocal rank fusion): материал, найденный и по смыслу, и по словам, поднимается выше. */
const RRF_K = 60

export type SearchMode = 'semantic' | 'words' | 'fallback'

/** Ближайшие материалы по смыслу: лучшая часть материала, порог и отступ от лучшего (настраиваются, шаг 4). */
export async function semanticHits(db: Db, vector: number[], minSimilarity: number, limit = SEMANTIC_LIMIT) {
  const q = JSON.stringify(vector)
  const rows = await db.execute<{ id: number; title: string; access: string; type: string; sim: number }>(sql`
    with near as (
      select material_id, 1 - (embedding <=> ${q}::vector) as sim
      from app.material_vectors
      order by embedding <=> ${q}::vector
      limit 60
    )
    select m.id, m.title, m.access, m.type, max(near.sim) as sim
    from near join payload.materials m on m.id = near.material_id
    where m._status = 'published' and coalesce(m.archived, false) = false
    group by m.id, m.title, m.access, m.type
    order by sim desc
    limit ${limit * 3}
  `)
  const top = Number(rows[0]?.sim ?? 0)
  return rows
    .map((r) => ({ id: Number(r.id), title: r.title, access: r.access === 'paid' ? ('paid' as const) : ('free' as const), type: r.type, sim: Number(r.sim) }))
    .filter((r) => r.sim >= minSimilarity && r.sim >= top - SIM_MARGIN)
    .slice(0, limit)
}

/** Гибрид: по смыслу + точное совпадение всех слов. Порядок — по сумме обратных рангов. */
export function mergeHits(semantic: SearchHit[], words: SearchHit[], limit = SEMANTIC_LIMIT): SearchHit[] {
  const score = new Map<number, { hit: SearchHit; s: number }>()
  for (const list of [semantic, words]) {
    list.forEach((hit, i) => {
      const cur = score.get(hit.id)
      score.set(hit.id, { hit: cur?.hit ?? hit, s: (cur?.s ?? 0) + 1 / (RRF_K + i + 1) })
    })
  }
  return [...score.values()]
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ hit: { id, title, access, type } }) => ({ id, title, access, type }))
}

/**
 * Поиск для мамы (приложение и бот). «Красные слова», согласие и лимит проверяет вызывающий — до этой функции.
 * По смыслу: переключатель включён и есть сервис векторов. Сбой или таймаут сервиса — поиск по словам
 * (mode: 'fallback') и алерт исполнителю; маме — обычный результат, без текста об ошибке.
 */
export async function findMaterials(
  db: Db,
  query: string,
  embed: EmbedProvider,
  wordsLimit = 10,
): Promise<{ mode: SearchMode; hits: SearchHit[] }> {
  const settings = await getSettings(db)
  if (!settings.semanticSearch || embed.id === 'fake') return { mode: 'words', hits: await searchMaterials(db, query, wordsLimit) }
  try {
    const [vector] = await embed.embed([query], 'query', QUERY_TIMEOUT_MS)
    const [semantic, words] = await Promise.all([
      semanticHits(db, vector!, settings.searchMinSimilarity),
      searchMaterials(db, query, SEMANTIC_LIMIT, true),
    ])
    return { mode: 'semantic', hits: mergeHits(semantic, words) }
  } catch (err) {
    // В тексте ошибки нет запроса: сервис векторов отвечает только кодом (см. embed.ts).
    void alert('search:fallback', `Поиск по смыслу недоступен, мамы ищут по словам — ${String(err).slice(0, 150)}`)
    return { mode: 'fallback', hits: await searchMaterials(db, query, wordsLimit) }
  }
}

/** Лимит 30 запросов в день на маму (ТЗ 10.1). В Redis — только хеш ID и число, без текста запроса. */
export async function takeSearchQuota(redis: Pick<Redis, 'incr' | 'expire'>, tgId: number, perDay = 30): Promise<boolean> {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
  const key = `search-quota:${hashTgId(tgId)}:${day}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, 2 * 24 * 3600)
  return n <= perDay
}

/** Темы для «Хочу материал на эту тему»: теги из словаря и «Другое» (ТЗ 11.2, Р2). */
export async function listTopics(db: Db): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(
    sql`select name from payload.tags where coalesce(hidden, false) = false order by "order", name`,
  )
  return [...rows.map((r) => r.name), 'Другое']
}

/**
 * «Хочу материал на эту тему»: только счётчик «тема + дата», текст запроса не хранится (ТЗ 11.2).
 * TODO(Р2): способ сбора утверждают заказчица и юрист; пока — счётчик тем по кнопке.
 */
export async function bumpWantedTopic(db: Db, topic: string): Promise<boolean> {
  if (!(await listTopics(db)).includes(topic)) return false
  await db
    .insert(statWantedTopic)
    .values({ topic, day: sql`(now() at time zone 'Europe/Moscow')::date`, count: 1 })
    .onConflictDoUpdate({ target: [statWantedTopic.topic, statWantedTopic.day], set: { count: sql`${statWantedTopic.count} + 1` } })
  return true
}
