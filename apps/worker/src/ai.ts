import Anthropic from '@anthropic-ai/sdk'
import { type AiProvider, type GroupBlock, fakeAiProvider, groupBlocks } from '@mama/shared'
import type { Logger } from 'pino'

// Обработчики очереди `ai` (CLAUDE.md). Сейчас одна задача — сборка статей из постов канала (ТЗ 9.9).
// TODO(Р4): провайдер выбирает заказчица. Для постов канала допустим Claude (они публичны, данные мам
// туда не уходят); без ANTHROPIC_API_KEY — фейковый провайдер: одна статья на пост, без ИИ.

/** Claude для сборки статей: только группировка, свой текст запрещён в инструкции и подсвечивается при проверке. */
export function claudeProvider(): AiProvider {
  const client = new Anthropic()
  return {
    id: 'claude',
    async complete(system, user) {
      const message = await client.beta.messages
        .stream({
          model: 'claude-opus-5-5',
          max_tokens: 64000,
          // Сервер сам переводит запрос на запасную модель, если основная откажется.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium' },
          system,
          messages: [{ role: 'user', content: user }],
        })
        .finalMessage()
      if (message.stop_reason === 'refusal') throw new Error('refusal')
      return message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    },
  }
}

export function aiProvider(): AiProvider {
  return process.env.AI_PROVIDER === 'claude' && process.env.ANTHROPIC_API_KEY ? claudeProvider() : fakeAiProvider
}

type Internal = (path: string, body: unknown) => Promise<unknown>

/** Вызов web изнутри (INTERNAL_SECRET): блоки из базы Payload и сборка черновиков. */
export function internalApi(baseUrl: string, secret: string): Internal {
  return async (path, body) => {
    const res = await fetch(`${baseUrl}/api/internal/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`internal ${path}: HTTP ${res.status}`)
    return res.json()
  }
}

/** Задача group-blocks: несобранные блоки → план ИИ (Zod) → черновики статей в Payload. */
export async function runGroupBlocks(call: Internal, provider: AiProvider, log: Logger, postIds: number[] | null) {
  const { blocks } = (await call('channel/pending', { postIds })) as { blocks: GroupBlock[] }
  if (blocks.length === 0) return
  const { plan, notes } = await groupBlocks(provider, blocks)
  const { created } = (await call('channel/assemble', { plan, notes })) as { created: number[] }
  log.info({ provider: provider.id, blocks: blocks.length, drafts: created.length }, 'channel blocks grouped')
}
