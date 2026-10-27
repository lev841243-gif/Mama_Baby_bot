import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = ReturnType<typeof createDb>

export function createDb(url = process.env.DATABASE_URL, max = 5) {
  if (!url) throw new Error('DATABASE_URL не задан')
  const client = postgres(url, { max, onnotice: () => {} })
  return drizzle(client, { schema })
}

let shared: Db | undefined

/** Один пул на процесс (Next.js и воркер). */
export function getDb(): Db {
  shared ??= createDb()
  return shared
}
