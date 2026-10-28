import { sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import type { Db } from './db/client'
import { statWantedTopic } from './db/schema'
import { hashTgId } from './log'
import { normalizeText } from './red-words'

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

/** Сначала все слова запроса, если пусто — любое из них. Слова — только буквы и цифры, поэтому tsquery безопасен. */
export async function searchMaterials(db: Db, query: string, limit = 10): Promise<SearchHit[]> {
  const words = [...new Set(normalizeText(query).filter((w) => w.length >= 2))].slice(0, MAX_WORDS)
  if (words.length === 0) return []
  const terms = words.map((w) => `${w}:*`)
  const all = await run(db, terms.join(' & '), limit)
  if (all.length > 0 || words.length === 1) return all
  return run(db, terms.join(' | '), limit)
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
