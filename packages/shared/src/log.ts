import { createHmac } from 'node:crypto'
import pino from 'pino'

// В логах нет Telegram ID в открытом виде, username, имён и текстов запросов (ТЗ 11.5, приёмка 5).
// ID пишем только как hashTgId(); остальное вырезается redact на случай ошибки.
const REDACT = [
  'tgId', '*.tgId', 'tg_id', '*.tg_id',
  'username', '*.username', 'first_name', '*.first_name', 'last_name', '*.last_name',
  'initData', '*.initData', 'text', '*.text', 'query', '*.query',
  'req.headers.authorization',
]

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT, censor: '[скрыто]' },
  })
}

export function hashTgId(tgId: number | bigint): string {
  const secret = process.env.LOG_HASH_SECRET
  if (!secret) throw new Error('LOG_HASH_SECRET не задан')
  return createHmac('sha256', secret).update(String(tgId)).digest('hex').slice(0, 16)
}
