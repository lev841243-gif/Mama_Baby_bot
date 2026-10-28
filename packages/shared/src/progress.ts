import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { bookmarks, lastOpened, materialDone, statMaterialDaily, users } from './db/schema'

// Прогресс мамы в приложении (ТЗ 11.1): закладки, «выполнено», последний открытый материал.
// Всё удаляется вместе с мамой (CASCADE). Вызывается только после проверки основного согласия.

async function userId(db: Db, tgId: number): Promise<number | null> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.tgId, tgId)).limit(1)
  return u?.id ?? null
}

export async function setBookmark(db: Db, tgId: number, materialId: number, on: boolean) {
  const id = await userId(db, tgId)
  if (!id) return
  if (on) await db.insert(bookmarks).values({ userId: id, materialId }).onConflictDoNothing()
  else await db.delete(bookmarks).where(and(eq(bookmarks.userId, id), eq(bookmarks.materialId, materialId)))
}

/** id материалов в закладках, новые сверху. */
export async function listBookmarks(db: Db, tgId: number): Promise<number[]> {
  const id = await userId(db, tgId)
  if (!id) return []
  const rows = await db
    .select({ materialId: bookmarks.materialId })
    .from(bookmarks)
    .where(eq(bookmarks.userId, id))
    .orderBy(desc(bookmarks.createdAt))
  return rows.map((r) => r.materialId)
}

export async function markDone(db: Db, tgId: number, materialId: number) {
  const id = await userId(db, tgId)
  if (id) await db.insert(materialDone).values({ userId: id, materialId }).onConflictDoNothing()
}

export async function listDone(db: Db, tgId: number): Promise<Set<number>> {
  const id = await userId(db, tgId)
  if (!id) return new Set()
  const rows = await db.select({ materialId: materialDone.materialId }).from(materialDone).where(eq(materialDone.userId, id))
  return new Set(rows.map((r) => r.materialId))
}

export async function setLastOpened(db: Db, tgId: number, materialId: number) {
  const id = await userId(db, tgId)
  if (!id) return
  const now = new Date()
  await db
    .insert(lastOpened)
    .values({ userId: id, materialId, openedAt: now })
    .onConflictDoUpdate({ target: lastOpened.userId, set: { materialId, openedAt: now } })
}

export async function getLastOpened(db: Db, tgId: number): Promise<number | null> {
  const id = await userId(db, tgId)
  if (!id) return null
  const [row] = await db.select({ materialId: lastOpened.materialId }).from(lastOpened).where(eq(lastOpened.userId, id))
  return row?.materialId ?? null
}

/** Состояние материала для мамы одним запросом: в закладках, выполнен. */
export async function materialState(db: Db, tgId: number, materialId: number) {
  const id = await userId(db, tgId)
  if (!id) return { bookmarked: false, done: false }
  const [b, d] = await Promise.all([
    db.select().from(bookmarks).where(and(eq(bookmarks.userId, id), eq(bookmarks.materialId, materialId))).limit(1),
    db.select().from(materialDone).where(and(eq(materialDone.userId, id), eq(materialDone.materialId, materialId))).limit(1),
  ])
  return { bookmarked: b.length > 0, done: d.length > 0 }
}

export type StatKind = 'view' | 'listen' | 'done' | 'hard'

/** Обезличенный счётчик «материал + день» (ТЗ 11.2): кто именно — не хранится. */
export async function bumpStat(db: Db, materialId: number, kind: StatKind) {
  await db
    .insert(statMaterialDaily)
    .values({ materialId, day: sql`(now() at time zone 'Europe/Moscow')::date`, kind, count: 1 })
    .onConflictDoUpdate({
      target: [statMaterialDaily.materialId, statMaterialDaily.day, statMaterialDaily.kind],
      set: { count: sql`${statMaterialDaily.count} + 1` },
    })
}
