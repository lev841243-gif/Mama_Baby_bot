import type { BotJob } from '@mama/shared'
import type { Api } from 'grammy'
import type { Redis } from 'ioredis'

export type SendAudioData = Extract<BotJob, { name: 'send-audio' }>['data']

// file_id Telegram по id файла: второй раз аудио уходит без скачивания. Ключ — id медиа, не мамы.
const cacheKey = (mediaId: number) => `tg-audio-file:${mediaId}`

/**
 * «Прислать в чат» (ТЗ 8.4): аудио приходит обычным аудио Telegram и играет в фоне.
 * Доступ к закрытому аудио проверен в web до постановки задачи (приёмка 16).
 */
export async function sendAudio(api: Api, redis: Pick<Redis, 'get' | 'set'>, d: SendAudioData) {
  const cached = await redis.get(cacheKey(d.mediaId))
  if (cached) {
    try {
      await api.sendAudio(d.tgId, cached, { title: d.title })
      return
    } catch {
      // file_id устарел (например, файл заменили) — шлём заново по ссылке.
    }
  }
  const msg = await api.sendAudio(d.tgId, d.url, { title: d.title })
  if (msg.audio?.file_id) await redis.set(cacheKey(d.mediaId), msg.audio.file_id, 'EX', 30 * 24 * 3600)
}
