import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client'
import { consents, users } from './db/schema'
import { CONSENT_TYPES, type ConsentType } from './consent-types'

export { CONSENT_TYPES, type ConsentType }

// TODO(Р8): версии текстов и флаг «существенное» переедут в Payload (шаг 2–3).
// Сейчас тексты — черновики 0.1 из yuridicheskie-shablony.
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  pd: '0.1',
  feed: '0.1',
  calendar: '0.1',
  ads: '0.1',
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
  /** Действующие согласия: тип → принятая версия. */
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
  for (const r of rows) granted[r.type] = r.version
  return { userId: user.id, granted, pdValid: granted.pd === CONSENT_VERSIONS.pd }
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
      const version = CONSENT_VERSIONS[type]
      const current = active.find((a) => a.type === type)
      if (current?.version === version) continue
      // Устаревшая версия закрывается, новая пишется отдельной записью (ТЗ 6.6).
      if (current) await tx.update(consents).set({ revokedAt: now }).where(eq(consents.id, current.id))
      await tx.insert(consents).values({ userId, type, version, grantedAt: now })
    }
  })

  return getConsentState(db, tgId)
}
