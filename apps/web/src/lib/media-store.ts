import 'server-only'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { MEDIA_DIR, s3Config } from './media-config'

// Чтение файлов медиа из S3 (прод) или с диска (локально) с поддержкой Range:
// аудио играет потоком и перематывается без полной загрузки (ТЗ 8.4, 13).

export type FileRange = { start: number; end: number }
export type OpenedFile = { body: ReadableStream; size: number; range?: FileRange }

let s3: S3Client | undefined
function client() {
  const c = s3Config()!
  s3 ??= new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  })
  return s3
}

/** «bytes=100-» → {start, end}. Невалидный или множественный диапазон — весь файл. */
export function parseRange(header: string | null, size: number): FileRange | undefined {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (m[1] === '' && m[2] === '')) return undefined
  let start: number
  let end: number
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return start <= end && start < size ? { start, end } : undefined
}

export async function openMediaFile(filename: string, rangeHeader: string | null): Promise<OpenedFile | null> {
  // Имя файла приходит из базы Payload, но на всякий случай не даём выйти из папки.
  const safe = path.basename(filename)
  const cfg = s3Config()
  if (cfg) {
    try {
      const head = await client().send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: safe }))
      const size = Number(head.ContentLength ?? 0)
      const range = parseRange(rangeHeader, size)
      const obj = await client().send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: safe, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
      )
      return { body: obj.Body!.transformToWebStream(), size, range }
    } catch {
      return null
    }
  }
  const full = path.join(MEDIA_DIR, safe)
  const info = await stat(full).catch(() => null)
  if (!info?.isFile()) return null
  const range = parseRange(rangeHeader, info.size)
  const stream = createReadStream(full, range ? { start: range.start, end: range.end } : undefined)
  return { body: Readable.toWeb(stream) as ReadableStream, size: info.size, range }
}
