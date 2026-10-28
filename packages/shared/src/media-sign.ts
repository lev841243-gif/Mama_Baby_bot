import { createHmac, timingSafeEqual } from 'node:crypto'

// Подписанные ссылки на медиа (ТЗ 8.6, 13): ссылку выдаёт сервер только после проверки доступа
// к материалу, поэтому закрытая картинка или аудио не открываются по «голой» прямой ссылке.
// Здесь — чтобы подписывать могли и web, и worker (картинка анонса ленты).

export type MediaVariant = 'original' | 'thumb' | 'card' | 'full'
export const MEDIA_VARIANTS: MediaVariant[] = ['original', 'thumb', 'card', 'full']

const HOUR = 3600
// Ссылка живёт 6–7 часов; конец срока округлён до часа, чтобы адрес не менялся и браузер кешировал файл.
const TTL_S = 6 * HOUR

function key() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET не задан')
  return `media:${secret}`
}

const sign = (id: number, variant: MediaVariant, exp: number) =>
  createHmac('sha256', key()).update(`${id}:${variant}:${exp}`).digest('base64url').slice(0, 32)

export function signedMediaPath(id: number, variant: MediaVariant, nowS = Math.floor(Date.now() / 1000)): string {
  const exp = Math.ceil((nowS + TTL_S) / HOUR) * HOUR
  return `/api/m/${id}/${variant}?e=${exp}&s=${sign(id, variant, exp)}`
}

export function verifyMediaSignature(id: number, variant: MediaVariant, exp: number, sig: string): boolean {
  if (!Number.isSafeInteger(exp) || exp < Date.now() / 1000) return false
  const expected = Buffer.from(sign(id, variant, exp))
  const got = Buffer.from(sig)
  return expected.length === got.length && timingSafeEqual(expected, got)
}
