import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client'
import { consents, feedSent, users } from './db/schema'
import { CONSENT_TYPES, type ConsentType } from './consent-types'

export { CONSENT_TYPES, type ConsentType }

/**
 * Версии текстов согласий (ТЗ 6.6, Р8). `current` — версия, которую мама принимает сейчас.
 * `required` — последняя версия, отмеченная автором как существенная: кто принял более раннюю,
 * проходит согласие заново при следующем действии (приёмка 4). Несущественная правка
 * (current > required) повторного согласия не требует.
 * TODO(шаг 3): версии и флаг «существенное» — из Payload, публикует автор.
 * Сейчас тексты — черновики 0.1 из yuridicheskie-shablony.
 */
export const CONSENT_VERSIONS: Record<ConsentType, { current: string; required: string }> = {
  pd: { current: '0.1', required: '0.1' },
  feed: { current: '0.1', required: '0.1' },
  calendar: { current: '0.1', required: '0.1' },
  ads: { current: '0.1', required: '0.1' },
}

/** Сравнение версий вида «1.2.3»: <0, 0, >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function isConsentVersionValid(
  type: ConsentType,
  version: string,
  versions: Record<ConsentType, { required: string }> = CONSENT_VERSIONS,
): boolean {
  return compareVersions(version, versions[type].required) >= 0
}

// В окне только работающие функции (ТЗ 8.9): календарь — с этапа 2, новости автора — только если Р6 «да».
export const CONSENT_FEATURES: Record<ConsentType, boolean> = {
  pd: true,
  feed: true,
  calendar: false,
  ads: false,
}

export type ConsentItem = {
  type: ConsentType
  required: boolean
  title: string
  hint: string
  /** Путь к тексту согласия на сайте проекта. */
  docPath: string
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

export function visibleConsentItems(): ConsentItem[] {
  return CONSENT_ITEMS.filter((i) => CONSENT_FEATURES[i.type])
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
  const granted: ConsentState['granted'] = {}
  // Согласие устаревшей существенной версии не действует — ни основное, ни необязательные.
  for (const r of rows) if (isConsentVersionValid(r.type, r.version)) granted[r.type] = r.version
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
  const visible = new Set(visibleConsentItems().map((i) => i.type))
  const wanted = [...new Set(types)].filter((t) => visible.has(t))
  if (!wanted.includes('pd')) throw new Error('pd consent required')

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
      const version = CONSENT_VERSIONS[type].current
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
    // Данные только для ленты (ТЗ 11.1). Настройки ленты и записи календаря — этап 2.
    if (type === 'feed') await tx.delete(feedSent).where(eq(feedSent.userId, user.id))
    return closed.length > 0 ? 'revoked' : 'none'
  })
}

/** Есть ли у мамы оплаченная подписка — для предупреждения при отзыве (ТЗ 6.5). TODO(шаг 8). */
export async function getActiveSubscriptionUntil(_db: Db, _tgId: number): Promise<Date | null> {
  return null
}
