import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Схема payload принадлежит Payload CMS — drizzle-kit её не трогает.
  schemaFilter: ['app'],
  migrations: { schema: 'app', table: '__drizzle_migrations' },
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
