import { parse, validate } from '@telegram-apps/init-data-node'

export class TmaAuthError extends Error {}

// initData живёт сутки: дольше мама держит приложение открытым редко, а подпись дольше не доверяем.
const INIT_DATA_TTL_S = 24 * 60 * 60

/**
 * Проверка подписи данных запуска от Telegram (ТЗ 8). Заголовок: `Authorization: tma <initDataRaw>`.
 * Возвращает только Telegram ID: имя и username из initData не читаем и не храним (ТЗ 11.4).
 */
export function authenticateTma(req: Request): { tgId: number } {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN не задан')
  const header = req.headers.get('authorization') ?? ''
  const [scheme, raw] = header.split(' ', 2)
  if (scheme !== 'tma' || !raw) throw new TmaAuthError('no init data')
  try {
    validate(raw, token, { expiresIn: INIT_DATA_TTL_S })
  } catch {
    throw new TmaAuthError('invalid init data')
  }
  const data = parse(raw)
  if (!data.user?.id) throw new TmaAuthError('no user')
  return { tgId: data.user.id }
}
