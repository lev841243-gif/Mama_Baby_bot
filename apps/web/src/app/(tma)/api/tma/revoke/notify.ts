import { getBotQueue, log } from '@/lib/server'

/** Последнее сообщение в чат после удаления (ТЗ 6.5). Сбой очереди не отменяет удаление. */
export async function notifyDataDeleted(tgId: number) {
  await getBotQueue()
    .add('data-deleted', { tgId }, { removeOnComplete: true, removeOnFail: 100 })
    .catch((err: unknown) => log.error({ err }, 'enqueue data-deleted failed'))
}
