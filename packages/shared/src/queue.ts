import { Redis } from 'ioredis'

// Очереди BullMQ: web кладёт задачи, worker (бот) выполняет.
export const QUEUE_BOT = 'bot'

export type BotJob =
  /** Мама приняла основное согласие в приложении → в чате появляется меню (ТЗ 6.1, шаг 3). */
  | { name: 'consent-granted'; data: { tgId: number } }
  /** Мама отозвала согласие в приложении → последнее сообщение в чат (ТЗ 6.5). */
  | { name: 'data-deleted'; data: { tgId: number } }
  /** Тестовая отправка анонса автору себе в бот (ТЗ 9.4). */
  | { name: 'test-announce'; data: { tgId: number; materialId: number; title: string; announce: string; photoUrl?: string } }

/** Клиент Redis для BullMQ (с v6 BullMQ ждёт готовый экземпляр ioredis). */
export function createRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new Redis(url, { maxRetriesPerRequest: null })
}
