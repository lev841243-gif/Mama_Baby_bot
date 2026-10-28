import { createHmac, timingSafeEqual } from 'node:crypto'

// Подписанные ссылки на медиа (ТЗ 8.6, 13): ссылку выдаёт сервер только после проверки доступа
// к материалу, поэтому закрытая картинка или аудио не открываются по «голой» прямой ссылке.

export type MediaVariant = 'original' | 'thumb' | 'card' | 'full'
export const MEDIA_VARIANTS: MediaVariant[] = ['original', 'thumb', 'card', 'full']

export type MediaDoc = {
  id: number
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  sizes?: Partial<Record<Exclude<MediaVariant, 'original'>, { filename?: string | null; width?: number | null; height?: number | null; mimeType?: string | null }>>
}

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

export type ClientImage = { src: string; srcSet?: string; width?: number; height?: number; alt?: string; video?: boolean }

/** Картинка для приложения: webp-размеры для srcset, MP4 — как видео (ТЗ: MP4 вместо GIF). */
export function clientImage(doc: MediaDoc | number | null | undefined): ClientImage | null {
  if (!doc || typeof doc === 'number') return null
  if (doc.mimeType?.startsWith('video/')) return { src: signedMediaPath(doc.id, 'original'), video: true, alt: doc.alt ?? undefined }
  if (!doc.mimeType?.startsWith('image/')) return null
  const sizes = (['thumb', 'card', 'full'] as const).filter((s) => doc.sizes?.[s]?.filename)
  const srcSet = sizes.map((s) => `${signedMediaPath(doc.id, s)} ${doc.sizes![s]!.width}w`).join(', ')
  return {
    src: signedMediaPath(doc.id, sizes.includes('card') ? 'card' : 'original'),
    srcSet: srcSet || undefined,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    alt: doc.alt ?? undefined,
  }
}

export function publicUrl(): string {
  return (process.env.PUBLIC_URL ?? 'https://localhost').replace(/\/$/, '')
}
