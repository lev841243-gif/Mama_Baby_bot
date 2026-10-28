import { z } from 'zod'

// Единый интерфейс ИИ-провайдеров (CLAUDE.md, ТЗ 10.6). Задачи идут через очередь `ai` (worker),
// ответы валидируются Zod. Тексты мам — только сервисы РФ (этапы 2–3); посты канала можно Claude.
// TODO(Р4): конкретные сервисы выбирает заказчица; без ключей работает фейковый провайдер.

export const QUEUE_AI = 'ai'

export interface AiProvider {
  readonly id: string
  /** Генерация по инструкции. Результат видит только автор (сборка статей из канала, ТЗ 10.5). */
  complete(system: string, user: string): Promise<string>
  /** Распознавание речи — этап 2 (SpeechKit / SaluteSpeech). */
  transcribe?(audio: Buffer): Promise<string>
  /** Извлечение структуры из текста — этап 2 (календарь навыков). */
  extract?<T>(text: string, schema: z.ZodType<T>): Promise<T>
  /** Векторы для поиска по смыслу — этап 3. */
  embed?(texts: string[]): Promise<number[][]>
}

export type AiJob = {
  name: 'group-blocks'
  data: { blocks: GroupBlock[]; requestedBy: string }
}

export type GroupBlock = { id: number; postId: number; heading: string | null; text: string }

export const groupPlanSchema = z.object({
  articles: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        announce: z.string().max(600),
        blockIds: z.array(z.number().int()).min(1),
      }),
    )
    .min(1),
})
export type GroupPlan = z.infer<typeof groupPlanSchema>

const firstSentence = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  const m = /^(.{10,}?[.!?…])(\s|$)/.exec(t)
  const sentence = m ? m[1]! : t
  return sentence.length <= max ? sentence : sentence.slice(0, sentence.lastIndexOf(' ', max) > 0 ? sentence.lastIndexOf(' ', max) : max)
}

/**
 * Без ИИ: одна статья на пост, заголовок — первый подзаголовок или первая фраза поста,
 * анонс — первая фраза. Всё взято из текста автора дословно.
 */
export function heuristicPlan(blocks: GroupBlock[]): GroupPlan {
  const byPost = new Map<number, GroupBlock[]>()
  for (const b of blocks) byPost.set(b.postId, [...(byPost.get(b.postId) ?? []), b])
  return {
    articles: [...byPost.values()].map((list) => {
      const first = list[0]!
      const bodyStart = list.find((b) => b.text.trim())?.text ?? first.heading ?? ''
      return {
        title: first.heading ?? firstSentence(bodyStart, 90),
        announce: firstSentence(bodyStart, 300),
        blockIds: list.map((b) => b.id),
      }
    }),
  }
}

const SYSTEM = `Ты помогаешь автору собрать короткие статьи из её постов в Telegram.
Тебе дают пронумерованные блоки текста. Сгруппируй блоки по темам в статьи и упорядочь их.
Правила:
- Не пиши свой текст и не переформулируй блоки — статья собирается только из блоков автора.
- Каждый блок используй не больше одного раза; повторы по смыслу клади в одну статью.
- Заголовок и анонс по возможности бери дословно из блоков; анонс — 2–3 строки.
- Ответь только JSON без пояснений: {"articles":[{"title":"...","announce":"...","blockIds":[1,2]}]}`

/** Группировка блоков в статьи (ТЗ 9.9, шаг 4). Ответ ИИ проверяется Zod; при ошибке — план без ИИ. */
export async function groupBlocks(provider: AiProvider, blocks: GroupBlock[]): Promise<{ plan: GroupPlan; notes: string[] }> {
  if (blocks.length === 0) return { plan: { articles: [] }, notes: [] }
  if (provider.id === 'fake') return { plan: heuristicPlan(blocks), notes: [] }
  const user = blocks.map((b) => `[${b.id}] (пост ${b.postId})${b.heading ? ` ${b.heading}\n` : '\n'}${b.text}`).join('\n\n')
  try {
    const raw = await provider.complete(SYSTEM, user)
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    const plan = groupPlanSchema.parse(json)
    const known = new Set(blocks.map((b) => b.id))
    const seen = new Set<number>()
    for (const a of plan.articles) {
      a.blockIds = a.blockIds.filter((id) => known.has(id) && !seen.has(id))
      a.blockIds.forEach((id) => seen.add(id))
    }
    plan.articles = plan.articles.filter((a) => a.blockIds.length > 0)
    // Блоки, которые ИИ не разложил, не теряются: отдельной статьёй по постам.
    const rest = blocks.filter((b) => !seen.has(b.id))
    if (rest.length) plan.articles.push(...heuristicPlan(rest).articles)
    return { plan, notes: [] }
  } catch {
    return { plan: heuristicPlan(blocks), notes: ['ИИ не ответил по формату — статьи разложены по постам без ИИ'] }
  }
}

export const fakeAiProvider: AiProvider = {
  id: 'fake',
  async complete() {
    return ''
  },
}
