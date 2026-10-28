import mammoth from 'mammoth'

// Импорт материала из .docx, заполненного по шаблону (ТЗ 9.2, 9.4, приёмка 7).
// Документ раскладывается по полям, результат — черновик, который автор проверяет перед публикацией.
// Ничего не дописываем: в материал попадает только текст документа.

export type DocxImage = { buffer: Buffer; contentType: string; name: string }

export type Inline = { text: string; bold?: boolean; italic?: boolean; href?: string }
export type Block =
  | { kind: 'p'; inlines: Inline[] }
  | { kind: 'h'; level: 2 | 3; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'img'; image: number }

export type ParsedMaterial = {
  title: string
  type: 'exercise' | 'article' | 'body' | 'psy' | null
  ageFrom: number | null
  ageTo: number | null
  tags: string[]
  skillsLeadsTo: string[]
  skillsRequires: string[]
  minutes: number | null
  access: 'free' | 'paid' | null
  inFeed: boolean | null
  announce: string
  cover: number | null
  steps: { text: string; image: number | null }[]
  body: Block[]
  howToKnow: string
  ifNotWorking: string
  easierVariant: string
  whenToSeeDoctor: string
  images: DocxImage[]
  warnings: string[]
}

// ---------- Мини-разбор HTML mammoth (он выдаёт простой и правильный HTML) ----------

type Node = { tag: string; attrs: Record<string, string>; children: Node[] } | { text: string }
const isText = (n: Node): n is { text: string } => 'text' in n

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[e]!)

const VOID = new Set(['img', 'br', 'hr'])

export function parseHtml(html: string): Node[] {
  const root: Node = { tag: 'root', attrs: {}, children: [] }
  const stack = [root] as Extract<Node, { tag: string }>[]
  const re = /<(\/?)([a-z0-9]+)([^>]*?)(\/?)>|([^<]+)/gi
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const top = stack[stack.length - 1]!
    if (m[5] !== undefined) {
      top.children.push({ text: decode(m[5]) })
      continue
    }
    const tag = m[2]!.toLowerCase()
    if (m[1]) {
      // Закрывающий тег: снимаем до совпадающего.
      const i = stack.map((n) => n.tag).lastIndexOf(tag)
      if (i > 0) stack.length = i
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of m[3]!.matchAll(/([a-z-]+)="([^"]*)"/gi)) attrs[a[1]!.toLowerCase()] = decode(a[2]!)
    const node = { tag, attrs, children: [] as Node[] }
    top.children.push(node)
    if (!VOID.has(tag) && !m[4]) stack.push(node)
  }
  return (root as { children: Node[] }).children
}

function inlines(nodes: Node[], fmt: Omit<Inline, 'text'> = {}): Inline[] {
  const out: Inline[] = []
  for (const n of nodes) {
    if (isText(n)) {
      if (n.text) out.push({ text: n.text, ...fmt })
      continue
    }
    if (n.tag === 'br') out.push({ text: '\n', ...fmt })
    else if (n.tag === 'strong' || n.tag === 'b') out.push(...inlines(n.children, { ...fmt, bold: true }))
    else if (n.tag === 'em' || n.tag === 'i') out.push(...inlines(n.children, { ...fmt, italic: true }))
    else if (n.tag === 'a' && /^https?:\/\//.test(n.attrs.href ?? '')) out.push(...inlines(n.children, { ...fmt, href: n.attrs.href }))
    else if (n.tag !== 'img') out.push(...inlines(n.children, fmt))
  }
  return out
}

const plain = (ins: Inline[]) => ins.map((i) => i.text).join('').replace(/\s+/g, ' ').trim()

function imagesIn(nodes: Node[]): number[] {
  const out: number[] = []
  for (const n of nodes) {
    if (isText(n)) continue
    const m = n.tag === 'img' ? /^img:(\d+)$/.exec(n.attrs.src ?? '') : null
    if (m) out.push(Number(m[1]))
    out.push(...imagesIn(n.children))
  }
  return out
}

/** Плоский список блоков документа. Таблицы и сложная вёрстка не поддерживаются (ТЗ 9.5) — берём из них текст. */
export function toBlocks(nodes: Node[]): Block[] {
  const out: Block[] = []
  for (const n of nodes) {
    if (isText(n)) {
      if (n.text.trim()) out.push({ kind: 'p', inlines: [{ text: n.text.trim() }] })
      continue
    }
    for (const image of imagesIn([n])) out.push({ kind: 'img', image })
    if (/^h[1-6]$/.test(n.tag)) {
      const ins = inlines(n.children)
      if (plain(ins)) out.push({ kind: 'h', level: n.tag === 'h1' || n.tag === 'h2' ? 2 : 3, inlines: ins })
    } else if (n.tag === 'ul' || n.tag === 'ol') {
      const items = n.children.filter((c) => !isText(c) && c.tag === 'li').map((li) => inlines((li as { children: Node[] }).children))
      if (items.length) out.push({ kind: 'list', ordered: n.tag === 'ol', items })
    } else if (n.tag === 'table') {
      out.push(...toBlocks(n.children))
    } else if (['tbody', 'thead', 'tr', 'td', 'th'].includes(n.tag)) {
      out.push(...toBlocks(n.children))
    } else {
      const ins = inlines(n.children)
      if (plain(ins)) out.push({ kind: 'p', inlines: ins })
    }
  }
  return out
}

// ---------- Шаблон упражнения ----------

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"':.,!?—–-]/g, ' ').replace(/\s+/g, ' ').trim()

/** Заголовки разделов шаблона. Ключ — нормализованный текст строки. */
const SECTIONS: Record<string, keyof ParsedMaterial | 'step'> = {
  обложка: 'cover',
  текст: 'body',
  'текст статьи': 'body',
  'текст практики': 'body',
  'как понять что получается': 'howToKnow',
  'если не получается': 'ifNotWorking',
  'облегченный вариант': 'easierVariant',
  'когда показать врачу': 'whenToSeeDoctor',
  анонс: 'announce',
}

const META: Record<string, string> = {
  название: 'title',
  тип: 'type',
  возраст: 'age',
  теги: 'tags',
  тег: 'tags',
  'ведет к': 'skillsLeadsTo',
  'нужно уметь': 'skillsRequires',
  время: 'minutes',
  доступ: 'access',
  лента: 'inFeed',
  'участвует в ленте': 'inFeed',
  анонс: 'announce',
}

function sectionOf(b: Block): keyof ParsedMaterial | 'step' | null {
  if (b.kind !== 'p' && b.kind !== 'h') return null
  const t = norm(plain(b.inlines))
  if (/^шаг \d+$/.test(t)) return 'step'
  return SECTIONS[t] ?? null
}

function metaOf(b: Block): { key: string; value: string } | null {
  if (b.kind !== 'p') return null
  const m = /^([^:]{2,30}):\s*(.*)$/.exec(plain(b.inlines))
  if (!m) return null
  const key = META[norm(m[1]!)]
  return key ? { key, value: m[2]!.trim() } : null
}

const list = (v: string) => v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)

function parseType(v: string): ParsedMaterial['type'] {
  const t = norm(v)
  if (t.startsWith('упражн')) return 'exercise'
  if (t.startsWith('стат')) return 'article'
  if (t.includes('телесн')) return 'body'
  if (t.includes('психолог')) return 'psy'
  return null
}

export function parseAge(v: string): { from: number; to: number } | null {
  const nums = v.match(/\d+/g)?.map(Number) ?? []
  if (nums.length < 2) return null
  const [from, to] = nums as [number, number]
  return from >= 0 && to > from && to <= 18 ? { from, to } : null
}

/** Разбор блоков документа по шаблону 9.2. Возвращает поля и предупреждения для автора. */
export function parseTemplate(blocks: Block[], images: DocxImage[]): ParsedMaterial {
  const r: ParsedMaterial = {
    title: '',
    type: null,
    ageFrom: null,
    ageTo: null,
    tags: [],
    skillsLeadsTo: [],
    skillsRequires: [],
    minutes: null,
    access: null,
    inFeed: null,
    announce: '',
    cover: null,
    steps: [],
    body: [],
    howToKnow: '',
    ifNotWorking: '',
    easierVariant: '',
    whenToSeeDoctor: '',
    images,
    warnings: [],
  }
  type Section = keyof ParsedMaterial | 'step' | 'head'
  let section: Section = 'head'
  const textOf: Partial<Record<string, string[]>> = {}
  const addText = (key: string, s: string) => (textOf[key] ??= []).push(s)

  for (const b of blocks) {
    const next = sectionOf(b)
    if (next) {
      section = next
      if (next === 'step') r.steps.push({ text: '', image: null })
      continue
    }
    if (section === 'head') {
      const meta = metaOf(b)
      if (meta) {
        const { key, value } = meta
        if (key === 'title') r.title = value
        else if (key === 'type') {
          r.type = parseType(value)
          if (!r.type) r.warnings.push(`Тип «${value}» не распознан`)
        } else if (key === 'age') {
          const age = parseAge(value)
          if (age) [r.ageFrom, r.ageTo] = [age.from, age.to]
          else if (value) r.warnings.push(`Возраст «${value}» не распознан, нужно «от–до» в месяцах`)
        } else if (key === 'tags') r.tags = list(value)
        else if (key === 'skillsLeadsTo') r.skillsLeadsTo = list(value)
        else if (key === 'skillsRequires') r.skillsRequires = list(value)
        else if (key === 'minutes') r.minutes = Number(value.match(/\d+/)?.[0]) || null
        else if (key === 'access') r.access = /подпис/i.test(value) ? 'paid' : /беспл/i.test(value) ? 'free' : null
        else if (key === 'inFeed') r.inFeed = /^да/i.test(value) ? true : /^нет/i.test(value) ? false : null
        else if (key === 'announce') addText('announce', value)
        continue
      }
      // Первая строка без «Название:» — тоже название.
      if (!r.title && b.kind !== 'img' && b.kind !== 'list') {
        r.title = plain(b.inlines)
        continue
      }
      if (b.kind === 'img' && r.cover === null) {
        r.cover = b.image
        continue
      }
      r.body.push(b)
      continue
    }
    if (section === 'cover') {
      if (b.kind === 'img' && r.cover === null) r.cover = b.image
      continue
    }
    if (section === 'step') {
      const step = r.steps[r.steps.length - 1]!
      if (b.kind === 'img') {
        if (step.image === null) step.image = b.image
        else r.warnings.push(`В шаге ${r.steps.length} больше одной картинки — взята первая`)
      } else {
        const t = b.kind === 'list' ? b.items.map(plain).join('\n') : plain(b.inlines)
        step.text = step.text ? `${step.text}\n${t}` : t
      }
      continue
    }
    if (section === 'body') {
      r.body.push(b)
      continue
    }
    if (b.kind === 'img') {
      r.warnings.push('Картинка вне шага, обложки или текста пропущена')
      continue
    }
    addText(section, b.kind === 'list' ? b.items.map((i) => `• ${plain(i)}`).join('\n') : plain(b.inlines))
  }

  r.announce = (textOf.announce ?? []).join('\n')
  r.howToKnow = (textOf.howToKnow ?? []).join('\n')
  r.ifNotWorking = (textOf.ifNotWorking ?? []).join('\n')
  r.easierVariant = (textOf.easierVariant ?? []).join('\n')
  r.whenToSeeDoctor = (textOf.whenToSeeDoctor ?? []).join('\n')

  if (!r.type) r.type = r.steps.length ? 'exercise' : 'article'
  if (!r.title) r.warnings.push('Не найдено название')
  if (r.type === 'exercise') {
    if (r.steps.length < 2 || r.steps.length > 6) r.warnings.push(`Шагов ${r.steps.length}, нужно 2–6`)
    r.steps.forEach((s, i) => {
      if (s.image === null) r.warnings.push(`В шаге ${i + 1} нет картинки`)
      if (!s.text) r.warnings.push(`В шаге ${i + 1} нет текста`)
    })
    if (!r.howToKnow) r.warnings.push('Не заполнено «Как понять, что получается»')
    if (r.body.length) r.warnings.push('Текст вне шагов в упражнении не используется — проверьте, всё ли попало в шаги')
  } else if (!r.body.length) {
    r.warnings.push('Не найден текст')
  }
  if ((r.type === 'exercise' || r.type === 'article') && r.ageFrom === null) r.warnings.push('Не указан возраст')
  if (r.tags.length === 0) r.warnings.push('Не указаны теги')
  if (r.tags.length > 3) r.warnings.push('Тегов больше трёх — оставлены первые три')
  return r
}

/** .docx → разобранный материал. Картинки — в порядке появления в документе. */
export async function parseDocx(buffer: Buffer): Promise<ParsedMaterial> {
  const images: DocxImage[] = []
  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const data = Buffer.from(await image.readAsArrayBuffer())
        const ext = image.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
        const idx = images.push({ buffer: data, contentType: image.contentType, name: `docx-${images.length + 1}.${ext}` }) - 1
        return { src: `img:${idx}` }
      }),
    },
  )
  const parsed = parseTemplate(toBlocks(parseHtml(html)), images)
  if (messages.some((m) => m.type === 'error')) parsed.warnings.push('Часть документа не прочиталась — сверьте с оригиналом')
  return parsed
}

// ---------- Блоки → Lexical (формат редактора Payload) ----------

const base = { format: '', indent: 0, version: 1, direction: 'ltr' as const }

function lexInlines(ins: Inline[]) {
  const text = (i: Inline) => ({
    type: 'text',
    text: i.text,
    format: (i.bold ? 1 : 0) | (i.italic ? 2 : 0),
    detail: 0,
    mode: 'normal',
    style: '',
    version: 1,
  })
  return ins.map((i) =>
    i.href
      ? { ...base, type: 'link', version: 3, fields: { url: i.href, newTab: true, linkType: 'custom' }, children: [text(i)] }
      : text(i),
  )
}

/** mediaIds[i] — id файла в Payload для картинки i документа. */
export function blocksToLexical(blocks: Block[], mediaIds: (number | null)[]) {
  const children = blocks.flatMap((b): unknown[] => {
    if (b.kind === 'p') return [{ ...base, type: 'paragraph', textFormat: 0, textStyle: '', children: lexInlines(b.inlines) }]
    if (b.kind === 'h') return [{ ...base, type: 'heading', tag: `h${b.level}`, children: lexInlines(b.inlines) }]
    if (b.kind === 'list')
      return [
        {
          ...base,
          type: 'list',
          listType: b.ordered ? 'number' : 'bullet',
          start: 1,
          tag: b.ordered ? 'ol' : 'ul',
          children: b.items.map((item, i) => ({ ...base, type: 'listitem', value: i + 1, children: lexInlines(item) })),
        },
      ]
    const id = mediaIds[b.image]
    return id ? [{ type: 'upload', version: 3, format: '', relationTo: 'media', value: id, fields: null }] : []
  })
  return { root: { ...base, type: 'root', children } }
}
