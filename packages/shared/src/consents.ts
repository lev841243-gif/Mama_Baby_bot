import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client'
import { consents, feedSent, feedSettings, skillCalendar, users } from './db/schema'
import { bumpDaily } from './summary'
import { getConsentVersions, getSettings, type AppSettings } from './settings'
import {
  CONSENT_TYPES,
  DEFAULT_CONSENT_VERSIONS,
  compareVersions,
  resolveConsentVersions,
  type ConsentType,
  type ConsentVersions,
} from './consent-types'

export { CONSENT_TYPES, DEFAULT_CONSENT_VERSIONS, compareVersions, resolveConsentVersions, type ConsentType, type ConsentVersions }

export function isConsentVersionValid(
  type: ConsentType,
  version: string,
  versions: Record<ConsentType, { required: string }> = DEFAULT_CONSENT_VERSIONS,
): boolean {
  return compareVersions(version, versions[type].required) >= 0
}

type FeatureSettings = Pick<AppSettings, 'calendarEnabled' | 'authorNews' | 'acceptAllSkipsOptional'>

// В окне только работающие функции (ТЗ 8.9): календарь — с этапа 2 после Р23, новости автора — только если Р6 «да».
export function consentFeatures(s: FeatureSettings): Record<ConsentType, boolean> {
  return { pd: true, feed: true, calendar: s.calendarEnabled, ads: s.authorNews }
}

export type ConsentItem = {
  type: ConsentType
  required: boolean
  title: string
  hint: string
  /** Путь к тексту согласия на сайте проекта. */
  docPath: string
}

export type VisibleConsentItem = ConsentItem & {
  /** Отмечается кнопкой «Принять всё» (Р27: календарь и реклама могут быть только своей галочкой). */
  inAcceptAll: boolean
}

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    type: 'pd',
    required: true,
    title: 'Обработка персональных данных',
    hint: 'Обязательно, без этого приложение не работает.',
    docPath: '/consent',
  },
  {
    type: 'feed',
    required: false,
    title: 'Лента',
    hint: 'Присылать упражнения по возрасту малыша, не чаще 2 раз в неделю.',
    docPath: '/rassylka',
  },
  {
    type: 'calendar',
    required: false,
    title: 'Календарь навыков',
    hint: 'Хранить ваши записи о навыках малыша.',
    docPath: '/calendar-consent',
  },
  {
    type: 'ads',
    required: false,
    title: 'Новости автора',
    hint: 'Анонсы курсов и эфиров.',
    docPath: '/news-consent',
  },
]

export function visibleConsentItems(s: FeatureSettings): VisibleConsentItem[] {
  const on = consentFeatures(s)
  return CONSENT_ITEMS.filter((i) => on[i.type]).map((i) => ({
    ...i,
    inAcceptAll: !(s.acceptAllSkipsOptional && (i.type === 'calendar' || i.type === 'ads')),
  }))
}

export type ConsentState = {
  userId: number | null
  /** Действующие согласия актуальной версии: тип → принятая версия. */
  granted: Partial<Record<ConsentType, string>>
  /** Есть основное согласие актуальной версии (ТЗ 6.1). */
  pdValid: boolean
}

export async function getConsentState(db: Db, tgId: number): Promise<ConsentState> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.tgId, tgId)).limit(1)
  if (!user) return { userId: null, granted: {}, pdValid: false }
  const rows = await db
    .select({ type: consents.type, version: consents.version })
    .from(consents)
    .where(and(eq(consents.userId, user.id), isNull(consents.revokedAt)))
  const versions = await getConsentVersions(db)
  const granted: ConsentState['granted'] = {}
  // Согласие устаревшей существенной версии не действует — ни основное, ни необязательные.
  for (const r of rows) if (isConsentVersionValid(r.type, r.version, versions)) granted[r.type] = r.version
  return { userId: user.id, granted, pdValid: granted.pd !== undefined }
}

export const grantConsentsInput = z.object({
  types: z
    .array(z.enum(CONSENT_TYPES))
    .min(1)
    .refine((t) => t.includes('pd'), 'Без основного согласия дальше не пройти'),
})

/**
 * Записывает согласия из окна (ТЗ 8.9). Первая запись о маме появляется только здесь,
 * и только вместе с основным согласием. Типы, которых нет в окне, отбрасываются.
 */
export async function grantConsents(
  db: Db,
  tgId: number,
  types: ConsentType[],
  opts: { isTester: boolean },
): Promise<ConsentState> {
  const visible = new Set(visibleConsentItems(await getSettings(db)).map((i) => i.type))
  const wanted = [...new Set(types)].filter((t) => visible.has(t))
  if (!wanted.includes('pd')) throw new Error('pd consent required')
  const versions = await getConsentVersions(db)

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ tgId, isTester: opts.isTester })
      .onConflictDoUpdate({ target: users.tgId, set: { lastActiveAt: new Date() } })
      .returning({ id: users.id })
    const userId = user!.id

    const active = await tx
      .select({ id: consents.id, type: consents.type, version: consents.version })
      .from(consents)
      .where(and(eq(consents.userId, userId), isNull(consents.revokedAt), inArray(consents.type, wanted)))

    const now = new Date()
    for (const type of wanted) {
      const version = versions[type].current
      const current = active.find((a) => a.type === type)
      if (current?.version === version) continue
      // Прежняя версия закрывается, новая пишется отдельной записью (ТЗ 6.6).
      if (current) await tx.update(consents).set({ revokedAt: now }).where(eq(consents.id, current.id))
      await tx.insert(consents).values({ userId, type, version, grantedAt: now })
    }
  })

  return getConsentState(db, tgId)
}

/**
 * Необязательное согласие позже окна: «Подписаться на ленту», «Включить календарь» (ТЗ 8.9, шаблон 07 §5–6).
 * Только при действующем основном согласии; пишет текущую версию, если её ещё нет. Возвращает id мамы.
 */
export async function grantOptionalConsent(db: Db, tgId: number, type: Exclude<ConsentType, 'pd'>): Promise<number> {
  const state = await getConsentState(db, tgId)
  if (!state.pdValid || state.userId === null) throw new Error('pd consent required')
  const userId = state.userId
  if (state.granted[type]) return userId
  const version = (await getConsentVersions(db))[type].current
  await db.transaction(async (tx) => {
    const now = new Date()
    // Устаревшая версия этого согласия закрывается, новая — отдельной записью (ТЗ 6.6).
    await tx
      .update(consents)
      .set({ revokedAt: now })
      .where(and(eq(consents.userId, userId), eq(consents.type, type), isNull(consents.revokedAt)))
    await tx.insert(consents).values({ userId, type, version, grantedAt: now })
  })
  return userId
}

/**
 * Полный отзыв согласия (ТЗ 6.5, 11.5): физическое удаление мамы. Всё её — через ON DELETE CASCADE,
 * записи об оплате остаются с обнулённой ссылкой. Возвращает false, если удалять было нечего.
 */
export async function deleteUserData(db: Db, tgId: number): Promise<boolean> {
  const deleted = await db.delete(users).where(eq(users.tgId, tgId)).returning({ id: users.id })
  return deleted.length > 0
}

export const revokeConsentInput = z.object({ type: z.enum(CONSENT_TYPES) })

/**
 * Снятие галочки в «Мои согласия» (ТЗ 8.9). Основное согласие — полный отзыв с удалением данных.
 * Необязательное — закрывается, и удаляются данные, нужные только для него.
 */
export async function revokeConsent(db: Db, tgId: number, type: ConsentType): Promise<'deleted' | 'revoked' | 'none'> {
  if (type === 'pd') return (await deleteUserData(db, tgId)) ? 'deleted' : 'none'

  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.tgId, tgId)).limit(1)
    if (!user) return 'none'
    const closed = await tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(consents.userId, user.id), eq(consents.type, type), isNull(consents.revokedAt)))
      .returning({ id: consents.id })
    // TODO(Р10): журнал отзывов (тип, версия, дата — без ID), если юрист скажет, что он нужен.
    // Данные, нужные только для этого согласия (ТЗ 11.1, 8.9): настройки и отправленное лентой, записи календаря.
    if (type === 'feed') {
      await tx.delete(feedSettings).where(eq(feedSettings.userId, user.id))
      await tx.delete(feedSent).where(eq(feedSent.userId, user.id))
    }
    if (type === 'calendar') await tx.delete(skillCalendar).where(eq(skillCalendar.userId, user.id))
    if (type === 'feed' && closed.length > 0) await bumpDaily(tx as unknown as Db, 'feed_unsubscribed')
    return closed.length > 0 ? 'revoked' : 'none'
  })
}

