import { sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { statDaily } from './db/schema'
import { AGE_SECTIONS, ageInMonths, ageSection } from './age'

// Сводка для автора (ТЗ 11.3): только агрегаты и обезличенные счётчики (ТЗ 11.2). Отдельные мамы не видны:
// в ответе нет ни одного ID, только числа и названия материалов.

/** Обезличенный счётчик «событие + день» (например, отписка от ленты, ТЗ 14). */
export async function bumpDaily(db: Db, kind: string) {
  await db
    .insert(statDaily)
    .values({ kind, day: sql`(now() at time zone 'Europe/Moscow')::date`, count: 1 })
    .onConflictDoUpdate({ target: [statDaily.kind, statDaily.day], set: { count: sql`${statDaily.count} + 1` } })
}

export type Summary = {
  users: { total: number; testers: number; activeWeek: number }
  feed: { total: number; bySection: { section: string; count: number }[]; unsubscribed30: number }
  subscriptionsActive: number
  /** Включённые календари навыков (ТЗ 11.2) — число, без мам. */
  calendarsActive: number
  popular: { title: string; views: number; listens: number }[]
  hard: { title: string; hard: number; done: number }[]
  wanted: { topic: string; count: number }[]
  sections: { section: string; count: number }[]
  /** Материалы ленты на каждый месяц возраста 3–17 (ТЗ 7): где лента скоро замолчит. Только контент. */
  feedMaterials: { month: number; free: number; paid: number }[]
}

const n = (v: unknown) => Number(v ?? 0)

export async function buildSummary(db: Db, days = 30): Promise<Summary> {
  const since = sql`(now() at time zone 'Europe/Moscow')::date - ${days}::int`

  const [u] = await db.execute<{ total: number; testers: number; active: number }>(sql`
    select count(*) total, count(*) filter (where is_tester) testers,
           count(*) filter (where last_active_at > now() - interval '7 days') active
    from app.users`)

  // Подписанные на ленту: действующее согласие на ленту; раздел — по месяцу и году рождения (агрегат).
  const feedRows = await db.execute<{ y: number | null; m: number | null }>(sql`
    select u.child_birth_year y, u.child_birth_month m
    from app.users u join app.consents c on c.user_id = u.id
    where c.type = 'feed' and c.revoked_at is null`)
  const bySection = new Map<string, number>()
  for (const r of feedRows) {
    const id = r.y && r.m ? ageSection(ageInMonths(r.y, r.m)) : null
    const sec = AGE_SECTIONS.find((x) => x.id === id)
    const s = !r.y || !r.m ? 'возраст не указан' : sec ? `${sec.from}–${sec.to} мес.` : 'вне 3–18 мес.'
    bySection.set(s, (bySection.get(s) ?? 0) + 1)
  }

  const [unsub] = await db.execute<{ c: number }>(sql`select coalesce(sum(count), 0) c from app.stat_daily where kind = 'feed_unsubscribed' and day >= ${since}`)
  const [subs] = await db.execute<{ c: number }>(sql`select count(*) c from app.subscriptions where ends_at > now()`)
  const [cals] = await db.execute<{ c: number }>(sql`select count(*) c from app.consents where type = 'calendar' and revoked_at is null`)

  const popular = await db.execute<{ title: string; views: number; listens: number }>(sql`
    select m.title, coalesce(sum(s.count) filter (where s.kind = 'view'), 0) views,
           coalesce(sum(s.count) filter (where s.kind = 'listen'), 0) listens
    from app.stat_material_daily s join payload.materials m on m.id = s.material_id
    where s.day >= ${since} and s.kind in ('view', 'listen')
    group by m.title order by views desc, listens desc limit 10`)

  // Трудные упражнения: где «Пока не получается» нажимают чаще (ТЗ 11.2).
  const hard = await db.execute<{ title: string; hard: number; done: number }>(sql`
    select m.title, coalesce(sum(s.count) filter (where s.kind = 'hard'), 0) hard,
           coalesce(sum(s.count) filter (where s.kind = 'done'), 0) done
    from app.stat_material_daily s join payload.materials m on m.id = s.material_id
    where s.day >= ${since} and s.kind in ('hard', 'done')
    group by m.title having coalesce(sum(s.count) filter (where s.kind = 'hard'), 0) > 0
    order by hard desc limit 10`)

  const wanted = await db.execute<{ topic: string; count: number }>(sql`
    select topic, sum(count) count from app.stat_wanted_topic where day >= ${since} group by topic order by count desc`)

  // Пустые и маленькие разделы: опубликованные материалы по разделам и «Спокойной маме».
  const mats = await db.execute<{ type: string; age_from: number | null; age_to: number | null; in_feed: boolean | null; access: string }>(sql`
    select type, age_from, age_to, in_feed, access from payload.materials where _status = 'published' and coalesce(archived, false) = false`)
  const sections = [
    ...AGE_SECTIONS.map((s) => ({
      section: `${s.from}–${s.to} мес.`,
      count: mats.filter((m) => m.age_from !== null && m.age_to !== null && m.age_from < s.to && m.age_to > s.from).length,
    })),
    { section: '«Спокойная мама»: телесные', count: mats.filter((m) => m.type === 'body').length },
    { section: '«Спокойная мама»: психологические', count: mats.filter((m) => m.type === 'psy').length },
  ]

  return {
    users: { total: n(u?.total), testers: n(u?.testers), activeWeek: n(u?.active) },
    feed: { total: feedRows.length, bySection: [...bySection].map(([section, count]) => ({ section, count })), unsubscribed30: n(unsub?.c) },
    subscriptionsActive: n(subs?.c),
    calendarsActive: n(cals?.c),
    popular: popular.map((r) => ({ title: r.title, views: n(r.views), listens: n(r.listens) })),
    hard: hard.map((r) => ({ title: r.title, hard: n(r.hard), done: n(r.done) })),
    wanted: wanted.map((r) => ({ topic: r.topic, count: n(r.count) })),
    sections,
    feedMaterials: Array.from({ length: 15 }, (_, i) => i + 3).map((month) => {
      const inFeed = mats.filter(
        (m) => m.in_feed && (m.type === 'exercise' || m.type === 'article') && m.age_from !== null && m.age_to !== null && Number(m.age_from) <= month && Number(m.age_to) > month,
      )
      return { month, free: inFeed.filter((m) => m.access !== 'paid').length, paid: inFeed.filter((m) => m.access === 'paid').length }
    }),
  }
}
