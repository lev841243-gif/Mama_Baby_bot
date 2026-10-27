// Миграции схемы app. Запускается после `payload migrate` (CLAUDE.md: сначала Payload, потом drizzle-kit).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb } from './client'
import { seedAccessList } from '../access'

const dir = path.dirname(fileURLToPath(import.meta.url))
const db = createDb(undefined, 1)

await migrate(db, {
  migrationsFolder: path.resolve(dir, '../../drizzle'),
  migrationsSchema: 'app',
  migrationsTable: '__drizzle_migrations',
})
const added = await seedAccessList(db, process.env.ACCESS_LIST_TG_IDS)
console.log(`app: миграции применены, список доступа из env: +${added}`)
await db.$client.end()
