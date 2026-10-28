import { QUEUE_BOT, createRedis } from '@mama/shared'
import { Queue } from 'bullmq'

// Очередь бота без server-only: её используют и хуки Payload (их читает CLI миграций).
let queue: Queue | undefined
export function botQueue() {
  queue ??= new Queue(QUEUE_BOT, { connection: createRedis() })
  return queue
}
