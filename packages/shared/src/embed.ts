import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client'
import { EMBED_DIMS, materialVectors } from './db/schema'
import { stemTokens } from './red-words'

// Векторы для поиска по смыслу (ТЗ 10.1, этап 3). Модель своя, на нашем сервере (решение Льва Л7):
// контейнер embed (text-embeddings-inference), порт наружу не открыт — текст запроса мамы не уходит с сервера.
// Запрос мамы (этап 3, шаг 3) считается прямым вызовом с коротким таймаутом, не через очередь: текст мамы
// не кладём в Redis. Через очередь `embed` идут только тексты автора.

export interface EmbedProvider {
  readonly id: string
  /** Модель: сменилась — все векторы пересчитываются. */
  model(): Promise<string>
  /** query — запрос мамы, passage — текст материала (у e5 разные префиксы). */
  embed(texts: string[], kind: 'query' | 'passage', timeoutMs?: number): Promise<number[][]>
}

const vectorsSchema = (n: number) => z.array(z.array(z.number().finite()).length(EMBED_DIMS)).length(n)
const infoSchema = z.object({ model_id: z.string().min(1) })

/** Семейство e5 обучено с префиксами «query: » и «passage: »; без них точность заметно ниже. */
const prefixFor = (model: string, kind: 'query' | 'passage') => (/e5/i.test(model) ? `${kind}: ` : '')

/** text-embeddings-inference: POST /embed, GET /info. Ответ проверяется Zod (размерность, числа). */
export function teiEmbedProvider(baseUrl: string): EmbedProvider {
  const url = baseUrl.replace(/\/$/, '')
  let modelId: string | undefined
  const model = async () => {
    if (!modelId) {
      const res = await fetch(`${url}/info`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`embed info: HTTP ${res.status}`)
      modelId = infoSchema.parse(await res.json()).model_id
    }
    return modelId
  }
  return {
    id: 'tei',
    model,
    async embed(texts, kind, timeoutMs = 60_000) {
      if (texts.length === 0) return []
      const prefix = prefixFor(await model(), kind)
      const out: number[][] = []
      // Сервер принимает до 32 текстов за раз.
      for (let i = 0; i < texts.length; i += 16) {
        const batch = texts.slice(i, i + 16)
        const res = await fetch(`${url}/embed`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputs: batch.map((t) => prefix + t), normalize: true, truncate: true }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        // Текст ответа об ошибке не пишем никуда: в нём может быть запрос мамы.
        if (!res.ok) throw new Error(`embed: HTTP ${res.status}`)
        out.push(...vectorsSchema(batch.length).parse(await res.json()))
      }
      return out
    },
  }
}

const fnv = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** Без сервиса: вектор по основам слов. Смысла не понимает, но путь целиком проверяется без сети. */
export const fakeEmbedProvider: EmbedProvider = {
  id: 'fake',
  async model() {
    return 'fake-stems'
  },
  async embed(texts) {
    return texts.map((t) => {
      const v = new Array<number>(EMBED_DIMS).fill(0)
      v[0] = 0.01
      for (const s of stemTokens(t)) {
        const h = fnv(s)
        v[1 + (h % (EMBED_DIMS - 1))]! += h & 1 ? 1 : -1
      }
      const norm = Math.hypot(...v)
      return v.map((x) => x / norm)
    })
  },
}

/** Провайдер по env: EMBED_URL — свой сервис векторов (в Docker — http://embed:80), пусто — фейковый. */
export function embedProvider(): EmbedProvider {
  const url = process.env.EMBED_URL
  return url ? teiEmbedProvider(url) : fakeEmbedProvider
}

export type MaterialSource = {
  id: number
  title: string
  announce: string | null
  searchText: string | null
  howMomsAsk: string | null
}

/** Номера частей: 0 — название и анонс, 1–9 — текст кусками, 10–19 — «Как мамы спрашивают». */
export const PART_BODY = 1
export const PART_ASK = 10
const BODY_CHUNK = 800

/** Части материала для векторов. Короткие куски: у модели окно ~512 токенов, длинный текст размывает смысл. */
export function materialParts(m: MaterialSource): { part: number; text: string }[] {
  const parts = [{ part: 0, text: [m.title, m.announce].filter((x) => x?.trim()).join('\n') }]
  const chunks: string[] = []
  let cur = ''
  for (const line of (m.searchText ?? '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (cur && cur.length + line.length + 1 > BODY_CHUNK) {
      chunks.push(cur)
      cur = ''
    }
    cur = cur ? `${cur}\n${line}` : line
  }
  if (cur) chunks.push(cur)
  chunks.slice(0, PART_ASK - PART_BODY).forEach((text, i) => parts.push({ part: PART_BODY + i, text: text.slice(0, BODY_CHUNK * 2) }))
  const asks = (m.howMomsAsk ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  asks.slice(0, 10).forEach((text, i) => parts.push({ part: PART_ASK + i, text }))
  return parts
}

export const partsHash = (model: string, parts: { part: number; text: string }[]) =>
  createHash('sha256').update(`${model}\n${JSON.stringify(parts)}`).digest('hex')

/**
 * Сверка векторов с опубликованными материалами: новые и изменённые пересчитываются, снятые с публикации и
 * архивные — удаляются. Изменилась модель — пересчитывается всё (хеш включает модель). Запускается раз в 2 минуты:
 * правка автора доходит до поиска ≤ 5 минут (ТЗ 9.4) без хуков в Payload.
 */
export async function syncMaterialVectors(db: Db, provider: EmbedProvider) {
  const model = await provider.model()
  const removed = await db.execute(sql`
    delete from app.material_vectors v
    where not exists (
      select 1 from payload.materials m
      where m.id = v.material_id and m._status = 'published' and coalesce(m.archived, false) = false
    )
    returning v.material_id`)
  const rows = await db.execute<{ id: number; title: string; announce: string | null; search_text: string | null; how_moms_ask: string | null }>(sql`
    select id, title, announce, search_text, how_moms_ask
    from payload.materials
    where _status = 'published' and coalesce(archived, false) = false
    order by id`)
  const existing = new Map(
    (await db.execute<{ material_id: number; hash: string }>(sql`select material_id, min(hash) as hash from app.material_vectors group by material_id`)).map(
      (r) => [Number(r.material_id), r.hash],
    ),
  )
  let indexed = 0
  let parts = 0
  for (const r of rows) {
    const id = Number(r.id)
    const list = materialParts({ id, title: r.title, announce: r.announce, searchText: r.search_text, howMomsAsk: r.how_moms_ask })
    const hash = partsHash(model, list)
    if (existing.get(id) === hash) continue
    const vectors = await provider.embed(
      list.map((p) => p.text),
      'passage',
    )
    await db.transaction(async (tx) => {
      await tx.execute(sql`delete from app.material_vectors where material_id = ${id}`)
      await tx.insert(materialVectors).values(list.map((p, i) => ({ materialId: id, part: p.part, model, hash, embedding: vectors[i]! })))
    })
    indexed++
    parts += list.length
  }
  return { model, indexed, parts, removed: new Set(removed.map((r) => Number(r.material_id))).size, total: rows.length }
}
