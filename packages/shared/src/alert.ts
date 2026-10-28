// Уведомления исполнителю в Telegram (ТЗ 13): падение, ошибки оплаты, рассылки, бэкапа.
// В тексте алерта — только что сломалось, без данных мам (ТЗ 11.5).
// ALERT_CHAT_ID — чат исполнителя (и по желанию автора); бот — ALERT_BOT_TOKEN или основной BOT_TOKEN.

const sentAt = new Map<string, number>()
const QUIET_MS = 10 * 60 * 1000

/** Не чаще раза в 10 минут на один ключ: шторм ошибок не превращается в шторм сообщений. */
export async function alert(key: string, text: string): Promise<void> {
  const chat = process.env.ALERT_CHAT_ID
  const token = process.env.ALERT_BOT_TOKEN || process.env.BOT_TOKEN
  if (!chat || !token) return
  const last = sentAt.get(key) ?? 0
  if (Date.now() - last < QUIET_MS) return
  sentAt.set(key, Date.now())
  const env = process.env.DOMAIN ?? 'local'
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: `⚠️ [${env}] ${text}`.slice(0, 3500), disable_web_page_preview: true }),
  }).catch(() => undefined)
}

/** Ключ Redis, куда worker пишет «жив» — его проверяет /api/health (Uptime Kuma). */
export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat'
