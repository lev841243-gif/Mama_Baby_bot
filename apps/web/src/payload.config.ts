import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { ru } from '@payloadcms/translations/languages/ru'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Users } from './collections/Users'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Админка автора (ТЗ 9.4). Данные мам сюда не попадают: они в схеме app (Drizzle).
// TODO(шаг 3): материалы, медиа в S3 (@payloadcms/storage-s3), словари, тексты бота, 2FA, журнал.
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — Дневник спокойного материнства' },
  },
  i18n: { supportedLanguages: { ru }, fallbackLanguage: 'ru' },
  collections: [Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    schemaName: 'payload',
    migrationDir: path.resolve(dirname, 'migrations'),
    // Схема меняется только миграциями (они идут в CI до drizzle-kit).
    push: false,
  }),
  sharp,
  telemetry: false,
})
