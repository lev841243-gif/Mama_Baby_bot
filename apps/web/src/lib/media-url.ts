import { signedMediaPath, type MediaVariant } from '@mama/shared'

export { MEDIA_VARIANTS, signedMediaPath, verifyMediaSignature, type MediaVariant } from '@mama/shared'

export type MediaDoc = {
  id: number
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  sizes?: Partial<Record<Exclude<MediaVariant, 'original'>, { filename?: string | null; width?: number | null; height?: number | null; mimeType?: string | null }>>
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
