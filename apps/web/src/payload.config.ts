import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { ru } from '@payloadcms/translations/languages/ru'
import { buildConfig } from 'payload'
import { payloadTotp } from 'payload-totp'
import sharp from 'sharp'
import { AuditLog } from './collections/AuditLog'
import { ConsentVersions } from './collections/ConsentVersions'
import { Materials } from './collections/Materials'
import { Media } from './collections/Media'
import { Playlists } from './collections/Playlists'
import { Skills } from './collections/Skills'
import { Tags } from './collections/Tags'
import { UsefulLinks } from './collections/UsefulLinks'
import { Users } from './collections/Users'
import { RedWords } from './globals/RedWords'
import { Settings } from './globals/Settings'
import { Texts } from './globals/Texts'
import { s3Config } from './lib/media-config'
import { importDocxEndpoint } from './payload/endpoints/import-docx'
import { testAnnounceEndpoint } from './payload/endpoints/test-announce'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const s3 = s3Config()

// Админка автора (ТЗ 9.4). Данные мам сюда не попадают: они в схеме app (Drizzle).
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — Дневник спокойного материнства' },
    components: {
      afterNavLinks: ['/components/admin/NavLinks#NavLinks'],
      views: {
        accessList: { Component: '/components/admin/AccessListView#AccessListView', path: '/access-list' },
        testers: { Component: '/components/admin/TestersView#TestersView', path: '/testers' },
        summary: { Component: '/components/admin/SummaryView#SummaryView', path: '/summary' },
        importDocx: { Component: '/components/admin/ImportDocxView#ImportDocxView', path: '/import-docx' },
      },
    },
  },
  i18n: { supportedLanguages: { ru }, fallbackLanguage: 'ru' },
  collections: [
    { ...Materials, endpoints: [importDocxEndpoint, testAnnounceEndpoint] },
    Media,
    Tags,
    Skills,
    UsefulLinks,
    Playlists,
    ConsentVersions,
    Users,
    AuditLog,
  ],
  globals: [Texts, RedWords, Settings],
  // Один формат разметки (ТЗ 9.5): жирный, курсив, ссылки, списки, подзаголовки, картинки. Без таблиц и цвета.
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
      BoldFeature(),
      ItalicFeature(),
      LinkFeature({ enabledCollections: ['materials'] }),
      UnorderedListFeature(),
      OrderedListFeature(),
      UploadFeature({ collections: { media: { fields: [] } } }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
    ],
  }),
  // Отложенная публикация материалов: задачи Payload, проверка раз в минуту в процессе web.
  jobs: {
    autoRun: [{ cron: '* * * * *', limit: 20, queue: 'default' }],
    shouldAutoRun: () => process.env.PAYLOAD_JOBS_AUTORUN !== 'false',
  },
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
  plugins: [
    s3Storage({
      enabled: Boolean(s3),
      collections: { media: true },
      bucket: s3?.bucket ?? '',
      config: {
        endpoint: s3?.endpoint,
        region: s3?.region,
        forcePathStyle: true,
        credentials: { accessKeyId: s3?.accessKeyId ?? '', secretAccessKey: s3?.secretAccessKey ?? '' },
      },
    }),
    // 2FA для всех учётных записей админки (ТЗ 13). Плагин оборачивает доступ всех коллекций — он последний.
    payloadTotp({
      collection: 'users',
      forceSetup: true,
      totp: { issuer: 'Дневник спокойного материнства' },
    }),
  ],
})
