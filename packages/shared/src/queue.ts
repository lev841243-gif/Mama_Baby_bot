import { Redis } from 'ioredis'

// Очереди BullMQ: web кладёт задачи, worker (бот) выполняет.
export const QUEUE_BOT = 'bot'

export type BotJob =
  /** Мама приняла основное согласие в приложении → в чате появляется меню (ТЗ 6.1, шаг 3). */
  | { name: 'consent-granted'; data: { tgId: number } }
  /** Мама отозвала согласие в приложении → последнее сообщение в чат (ТЗ 6.5). */
  | { name: 'data-deleted'; data: { tgId: number } }
  /** «Прислать в чат» (ТЗ 8.4): аудио играет как обычное аудио Telegram, в том числе в фоне. Доступ проверен в web. */
  | { name: 'send-audio'; data: { tgId: number; mediaId: number; title: string; url: string } }
  /** Оплата подтверждена — сообщение в чат (ТЗ 8.6). */
  | { name: 'subscription-paid'; data: { tgId: number; endsAt: string } }
  /** Раз в час: напоминания за 3 дня до конца подписки (ТЗ 8.6, приёмка 18). */
  | { name: 'subscriptions-tick'; data: { tgId?: undefined } }
  /** Кнопка «Открыть в приложении» под постом канала (ТЗ 9.9). */
  | { name: 'channel-button'; data: { tgId?: undefined; postId: number; materialId: number } }
  /** Тестовая отправка анонса автору себе в бот (ТЗ 9.4). */
  | { name: 'test-announce'; data: { tgId: number; materialId: number; title: string; announce: string; photoUrl?: string } }

/** Клиент Redis для BullMQ (с v6 BullMQ ждёт готовый экземпляр ioredis). */
export function createRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new Redis(url, { maxRetriesPerRequest: null })
}
