import path from 'node:path'

/** Локальная папка медиа, если S3 не настроен (локальная разработка). В Docker — volume. */
export const MEDIA_DIR = process.env.MEDIA_DIR ?? path.resolve(process.cwd(), 'media')

/** S3-совместимое хранилище в РФ (например S3 Beget). Включается, когда задан S3_BUCKET. */
export const s3Config = () =>
  process.env.S3_BUCKET
    ? {
        bucket: process.env.S3_BUCKET,
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'ru-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      }
    : null
