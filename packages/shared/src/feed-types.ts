// Лента (ТЗ 7): время, пояса, частота. Без зависимостей — импортируется и в мини-приложение.

/** Время ленты по времени мамы: утро 9–11, день 13–15, вечер 19–21 (ТЗ 7). Конец не включается. */
export const FEED_SLOTS = {
  morning: { from: 9, to: 11 },
  day: { from: 13, to: 15 },
  evening: { from: 19, to: 21 },
} as const

export type FeedSlot = keyof typeof FEED_SLOTS
export const FEED_SLOT_IDS = Object.keys(FEED_SLOTS) as FeedSlot[]

/** Тихие часы 22:00–8:00 по времени мамы — ничего не отправляется (ТЗ 7, приёмка 28). */
export const QUIET_FROM = 22
export const QUIET_TO = 8

/** Пояса РФ (решение Льва 28.10.2026, Л5). По умолчанию московский (ТЗ 7). */
export const RU_TIMEZONES = [
  { id: 'Europe/Kaliningrad', label: 'Калининград (МСК−1)' },
  { id: 'Europe/Moscow', label: 'Москва (МСК)' },
  { id: 'Europe/Samara', label: 'Самара (МСК+1)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (МСК+2)' },
  { id: 'Asia/Omsk', label: 'Омск (МСК+3)' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск (МСК+4)' },
  { id: 'Asia/Irkutsk', label: 'Иркутск (МСК+5)' },
  { id: 'Asia/Yakutsk', label: 'Якутск (МСК+6)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (МСК+7)' },
  { id: 'Asia/Magadan', label: 'Магадан (МСК+8)' },
  { id: 'Asia/Kamchatka', label: 'Камчатка (МСК+9)' },
] as const

export const DEFAULT_TIMEZONE = 'Europe/Moscow'

export function isRuTimezone(tz: string): boolean {
  return RU_TIMEZONES.some((z) => z.id === tz)
}

export function timezoneLabel(tz: string): string {
  return RU_TIMEZONES.find((z) => z.id === tz)?.label ?? tz
}

/** Пауза: 1 неделя, 2 недели, месяц (ТЗ 7). */
export const FEED_PAUSE_DAYS = [7, 14, 30] as const
export type FeedPauseDays = (typeof FEED_PAUSE_DAYS)[number]

/** «не чаще 2 раз в неделю», «не чаще 1 раза». */
export function timesLabel(n: number): string {
  return n === 1 ? '1 раза' : `${n} раз`
}

/** Лента — до 18 месяцев (ТЗ 5): старше подписка не предлагается. Младше 3 — начнётся сама. */
export const FEED_MIN_MONTHS = 3
export const FEED_MAX_MONTHS = 18

/** Состояние ленты для бота и приложения. */
export type FeedStatePayload = {
  /** Действует согласие на ленту. */
  consent: boolean
  /** Есть настройки (время выбрано). Согласие без настроек — после окна согласий этапа 1 (Л3). */
  settings: { slot: FeedSlot; timezone: string; pausedUntil: string | null } | null
  birth: { year: number; month: number } | null
  perWeek: number
}
