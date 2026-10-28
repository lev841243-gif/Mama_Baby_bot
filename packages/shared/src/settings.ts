import { sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { appSettings } from './db/schema'
import { DEFAULT_CONSENT_VERSIONS, type ConsentVersions } from './consent-types'
import { DEFAULT_EMERGENCY_TEXT, DEFAULT_RED_WORDS, type RedWordsConfig } from './red-words'
import { DEFAULT_SUBSCRIPTION, type SubscriptionConfig } from './subscription'
import { DEFAULT_TEXTS, type TextKey } from './texts'

/**
 * Переключатели проекта (ТЗ 14, 9.4). Значения по умолчанию — из env,
 * переопределяются в админке (Payload global «Настройки» пишет их в app.app_settings).
 */
export type AppSettings = {
  /** Бот и приложение работают только для списка доступа. */
  closedMode: boolean
  /** Дисклеймер бета-версии: приветствие, /help, плашка, над окном согласий. */
  betaBanner: boolean
  /**
   * Идёт тестирование: каждый новый пользователь помечается is_tester и удаляется кнопкой
   * «Удалить данные тестировщиков». Выключается перед бета-тестом с мамами.
   */
  testerPhase: boolean
  /** Частота ленты, раз в неделю (ТЗ 7, этап 2). */
  feedPerWeek: number
  /** Р11: раздел, где меньше smallSectionMin материалов, не показывается. */
  hideSmallSections: boolean
  smallSectionMin: number
  /** Р24: встраивать виджет Яндекс Музыки (после проверки на iPhone и Android), иначе только кнопка-ссылка. */
  musicWidget: boolean
  /**
   * Календарь навыков работает (этап 2): пункт в окне согласий, «Записать навык», экран в приложении.
   * Включать для мам только после решения юриста (Р23).
   */
  calendarEnabled: boolean
  /** Р6: «Новости автора» — пункт в окне согласий и разовые рассылки. */
  authorNews: boolean
  /** Р27: календарь и новости автора не входят в «Принять всё», только своей галочкой. */
  acceptAllSkipsOptional: boolean
  /** Р9: удалять мам без действий `inactiveMonths` месяцев (кроме записей об оплате), предупредив за 2 недели. */
  inactiveCleanup: boolean
  inactiveMonths: number
  /** Р10: обезличенный журнал отзывов — тип согласия, день, число; без ID. */
  revocationLog: boolean
  /** Поиск по смыслу (этап 3): выключен — поиск по словам, как на этапе 1. */
  semanticSearch: boolean
  /** Порог сходства 0–1: ниже — «Такой статьи пока нет». Подбирается тестом автора «25 из 30» (ТЗ 10.1). */
  searchMinSimilarity: number
  /** Лимит поисковых запросов в день на маму (ТЗ 10.1), общий для приложения, бота и голоса (Л10). */
  searchPerDay: number
}

export type Texts = Record<TextKey, string>

/** Всё, что правится в админке и нужно и боту, и мини-приложению. */
export type SharedConfig = {
  settings: AppSettings
  texts: Texts
  redWords: RedWordsConfig
  consentVersions: ConsentVersions
  subscription: SubscriptionConfig
}

/** Ключи app_settings, которые пишет админка. */
export const SETTINGS_KEYS = [
  'closedMode',
  'betaBanner',
  'testerPhase',
  'feedPerWeek',
  'hideSmallSections',
  'smallSectionMin',
  'musicWidget',
  'calendarEnabled',
  'authorNews',
  'acceptAllSkipsOptional',
  'inactiveCleanup',
  'inactiveMonths',
  'revocationLog',
  'semanticSearch',
  'searchMinSimilarity',
  'searchPerDay',
] as const
export const CONFIG_KEYS = { texts: 'texts', redWords: 'redWords', consentVersions: 'consentVersions', subscription: 'subscription' } as const

const flag = (name: string, fallback: boolean) => {
  const v = process.env[name]?.trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

export function defaultSettings(): AppSettings {
  return {
    // По ТЗ 14 закрытый режим включён; Лев 28.10.2026 решил открыть бот на время разработки (CLOSED_MODE=false).
    closedMode: flag('CLOSED_MODE', true),
    betaBanner: flag('BETA_BANNER', true),
    testerPhase: flag('TESTER_PHASE', true),
    feedPerWeek: 2,
    hideSmallSections: true,
    smallSectionMin: 5,
    // TODO(Р24): включить после проверки виджета на телефонах.
    musicWidget: false,
    // Лев 28.10.2026: на время разработки календарь и голос включены (голос — фейковый провайдер, TODO(Р4)).
    // Пишут только тестировщики, их данные удаляются перед бета-тестом. TODO(Р23): для мам — после юриста.
    calendarEnabled: flag('CALENDAR_ENABLED', true),
    // TODO(Р6): на старте разовые рассылки не делаем.
    authorNews: false,
    // TODO(Р27): решает юрист.
    acceptAllSkipsOptional: false,
    // TODO(Р9): включить, если заказчица и юрист согласятся.
    inactiveCleanup: false,
    inactiveMonths: 12,
    // TODO(Р10): включить, если юрист скажет, что журнал нужен.
    revocationLog: false,
    // Этап 3: своя модель векторов (Л7). Порог 0,84 — для multilingual-e5-small по пробным запросам;
    // уточняется на тесте автора (шаг 4).
    semanticSearch: flag('SEMANTIC_SEARCH', true),
    searchMinSimilarity: 0.84,
    searchPerDay: 30,
  }
}

/**
 * Живой объект текстов: обновляется при каждой загрузке конфигурации, поэтому `T.welcome`
 * в боте всегда показывает последнюю правку автора (не старше TTL).
 */
export const T: Texts = { ...DEFAULT_TEXTS }

// Правка в админке должна доезжать за ≤ 5 минут (ТЗ 9.4); держим 30 с.
const TTL_MS = 30_000
let cache: { at: number; value: SharedConfig } | undefined

function mergeTexts(stored: unknown): Texts {
  const out = { ...DEFAULT_TEXTS } as Texts
  if (stored && typeof stored === 'object') {
    for (const [k, v] of Object.entries(stored)) {
      // Пустое поле в админке — значит «по умолчанию».
      if (k in out && typeof v === 'string' && v.trim()) out[k as TextKey] = v
    }
  }
  return out
}

function mergeRedWords(stored: unknown): RedWordsConfig {
  const s = (stored ?? {}) as Partial<RedWordsConfig>
  const words = Array.isArray(s.words) ? s.words.filter((w) => typeof w === 'string' && w.trim()) : []
  return {
    // Пустой список недопустим: пропуск «красного слова» хуже лишнего срабатывания.
    words: words.length ? words : DEFAULT_RED_WORDS,
    emergencyText: typeof s.emergencyText === 'string' && s.emergencyText.trim() ? s.emergencyText : DEFAULT_EMERGENCY_TEXT,
  }
}

function mergeSubscription(stored: unknown): SubscriptionConfig {
  const s = (stored ?? {}) as Partial<SubscriptionConfig>
  const plans = Array.isArray(s.plans) ? s.plans.filter((p) => p && p.id && p.periodDays > 0) : []
  return {
    description: typeof s.description === 'string' && s.description.trim() ? s.description : DEFAULT_SUBSCRIPTION.description,
    plans: plans.length ? plans : DEFAULT_SUBSCRIPTION.plans,
  }
}

export async function getConfig(db: Db): Promise<SharedConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  const rows = await db.select().from(appSettings)
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const settings = defaultSettings()
  for (const key of SETTINGS_KEYS) {
    const v = byKey.get(key)
    if (v !== undefined && v !== null && typeof v === typeof settings[key]) (settings as Record<string, unknown>)[key] = v
  }
  const texts = mergeTexts(byKey.get(CONFIG_KEYS.texts))
  Object.assign(T, texts)
  const versions = byKey.get(CONFIG_KEYS.consentVersions) as ConsentVersions | undefined
  const value: SharedConfig = {
    settings,
    texts,
    redWords: mergeRedWords(byKey.get(CONFIG_KEYS.redWords)),
    consentVersions: { ...DEFAULT_CONSENT_VERSIONS, ...(versions ?? {}) },
    subscription: mergeSubscription(byKey.get(CONFIG_KEYS.subscription)),
  }
  cache = { at: Date.now(), value }
  return value
}

/** Настройки из последней загрузки (бот загружает их на каждое обновление) — для синхронных мест вроде меню. */
export function cachedSettings(): AppSettings {
  return cache?.value.settings ?? defaultSettings()
}

export async function getSettings(db: Db): Promise<AppSettings> {
  return (await getConfig(db)).settings
}

export async function getTexts(db: Db): Promise<Texts> {
  return (await getConfig(db)).texts
}

export async function getConsentVersions(db: Db): Promise<ConsentVersions> {
  return (await getConfig(db)).consentVersions
}

export async function getRedWords(db: Db): Promise<RedWordsConfig> {
  return (await getConfig(db)).redWords
}

/** Запись из админки (хуки Payload). Сбрасывает кеш этого процесса; другой процесс увидит правку за TTL. */
export async function setAppSettings(db: Db, entries: Record<string, unknown>) {
  const now = new Date()
  for (const [key, value] of Object.entries(entries)) {
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value`, updatedAt: now } })
  }
  resetSettingsCache()
}

export function resetSettingsCache() {
  cache = undefined
}
