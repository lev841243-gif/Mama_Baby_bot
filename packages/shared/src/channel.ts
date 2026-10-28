// Перенос постов канала (ТЗ 9.9). Чистые функции: разбор выгрузки Telegram Desktop и сообщений бота,
// отбор служебных постов в «пропущено», нарезка поста на смысловые блоки. Каждый пост оказывается
// либо в блоках, либо в «пропущено» с причиной (приёмка 31). Текст не меняется ни на символ.

/** Фрагмент текста Telegram: строка или сущность (жирный, ссылка…). */
export type TgTextPart = string | { type: string; text: string; href?: string }

/** Сообщение из result.json выгрузки Telegram Desktop (только нужные поля). */
export type ExportMessage = {
  id: number
  type: string
  date?: string
  date_unixtime?: string
  text?: string | TgTextPart[]
  photo?: string
  media_type?: string
  file?: string
  forwarded_from?: string
  poll?: unknown
  edited?: string
}

/** Пост канала после склейки альбома: текст и картинки. */
export type ChannelPostInput = {
  postId: number
  date: string
  parts: TgTextPart[]
  photos: string[]
  forwarded: boolean
  service: boolean
  poll: boolean
  otherMedia: boolean
}

export type Line = { text: string; bold: boolean }
export type Block = { heading: string | null; text: string }

export type Classified =
  | { kind: 'skip'; reason: string; text: string }
  | { kind: 'post'; text: string; blocks: Block[]; carousel: boolean }

const asParts = (t: ExportMessage['text']): TgTextPart[] => (typeof t === 'string' ? [t] : (t ?? []))

/** Альбом в выгрузке — несколько сообщений с одной датой подряд; текст обычно у одного из них. */
export function groupExport(messages: ExportMessage[]): ChannelPostInput[] {
  const out: ChannelPostInput[] = []
  for (const m of messages) {
    const prev = out[out.length - 1]
    const sameAlbum =
      prev && m.type === 'message' && m.photo && prev.photos.length > 0 && prev.date === (m.date ?? '') && !prev.service
    if (sameAlbum) {
      prev.photos.push(m.photo!)
      if (prev.parts.length === 0) prev.parts = asParts(m.text)
      continue
    }
    out.push({
      postId: m.id,
      date: m.date ?? '',
      parts: asParts(m.text),
      photos: m.photo ? [m.photo] : [],
      forwarded: Boolean(m.forwarded_from),
      service: m.type !== 'message',
      poll: Boolean(m.poll),
      otherMedia: Boolean(m.media_type || m.file) && !m.photo,
    })
  }
  return out
}

/** Текст + строки с признаком «вся строка жирная» (так авторы оформляют подзаголовки). */
export function toLines(parts: TgTextPart[]): Line[] {
  const lines: Line[] = [{ text: '', bold: true }]
  let hasText = [false]
  for (const p of parts) {
    const text = typeof p === 'string' ? p : p.text
    const bold = typeof p !== 'string' && (p.type === 'bold' || p.type === 'strong')
    const pieces = text.split('\n')
    pieces.forEach((piece, i) => {
      if (i > 0) {
        lines.push({ text: '', bold: true })
        hasText = [...hasText, false]
      }
      const cur = lines[lines.length - 1]!
      cur.text += piece
      if (piece.trim()) {
        hasText[hasText.length - 1] = true
        if (!bold) cur.bold = false
      }
    })
  }
  return lines.map((l, i) => ({ text: l.text, bold: hasText[i]! && l.bold }))
}

export const plainText = (parts: TgTextPart[]) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')

const isHeading = (l: Line) => l.bold && l.text.trim().length > 0 && l.text.trim().length <= 120

/** Нарезка: подзаголовок вместе с его абзацами (ТЗ 9.9, шаг 3). Без подзаголовков — один блок. */
export function splitBlocks(lines: Line[]): Block[] {
  const blocks: Block[] = []
  let cur: { heading: string | null; body: string[] } = { heading: null, body: [] }
  const flush = () => {
    const text = cur.body.join('\n').replace(/^\n+|\n+$/g, '')
    if (cur.heading || text.trim()) blocks.push({ heading: cur.heading, text })
  }
  for (const l of lines) {
    if (isHeading(l)) {
      flush()
      cur = { heading: l.text.trim(), body: [] }
    } else {
      cur.body.push(l.text)
    }
  }
  flush()
  return blocks
}

// Пост короче этого без подзаголовков — не материал: «Доброе утро», анонс эфира, подпись к картинке.
const MIN_TEXT = 120

/** Отбор: материал или «пропущено» с причиной, которую видит автор (ТЗ 9.9, шаг 1). */
export function classifyPost(p: ChannelPostInput): Classified {
  const text = plainText(p.parts)
  const t = text.trim()
  if (p.service) return { kind: 'skip', reason: 'служебное сообщение канала', text }
  if (p.forwarded) return { kind: 'skip', reason: 'репост из другого канала', text }
  if (p.poll) return { kind: 'skip', reason: 'опрос', text }
  if (/#реклама|\berid\b/i.test(t)) return { kind: 'skip', reason: 'реклама', text }
  // Карусель: несколько картинок и мало текста — текст на картинках, нужен исходник или распознавание.
  if (p.photos.length >= 2 && t.length < MIN_TEXT) return { kind: 'post', text, blocks: t ? [{ heading: null, text: t }] : [], carousel: true }
  if (!t) return { kind: 'skip', reason: p.photos.length || p.otherMedia ? 'медиа без текста' : 'пустой пост', text }
  if (t.length < MIN_TEXT) return { kind: 'skip', reason: 'короткий пост — не материал', text }
  return { kind: 'post', text, blocks: splitBlocks(toLines(p.parts)), carousel: false }
}

/** Сообщение Bot API (channel_post) → тот же вход, что из выгрузки. Сущности → фрагменты с жирным. */
export function fromBotMessage(m: {
  message_id: number
  date: number
  text?: string
  caption?: string
  entities?: { type: string; offset: number; length: number }[]
  caption_entities?: { type: string; offset: number; length: number }[]
  photo?: unknown[]
  forward_origin?: unknown
  poll?: unknown
  document?: unknown
  video?: unknown
}): ChannelPostInput {
  const text = m.text ?? m.caption ?? ''
  const entities = (m.entities ?? m.caption_entities ?? []).filter((e) => e.type === 'bold')
  const parts: TgTextPart[] = []
  let pos = 0
  // Смещения Bot API — в UTF-16, как и индексы строк JS.
  for (const e of [...entities].sort((a, b) => a.offset - b.offset)) {
    if (e.offset < pos) continue
    if (e.offset > pos) parts.push(text.slice(pos, e.offset))
    parts.push({ type: 'bold', text: text.slice(e.offset, e.offset + e.length) })
    pos = e.offset + e.length
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return {
    postId: m.message_id,
    date: new Date(m.date * 1000).toISOString(),
    parts,
    photos: m.photo ? ['photo'] : [],
    forwarded: Boolean(m.forward_origin),
    service: false,
    poll: Boolean(m.poll),
    otherMedia: Boolean(m.document || m.video),
  }
}
