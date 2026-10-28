// Разбор записи календаря навыков (ТЗ 10.4) — только правилами, без ИИ (решение Льва 28.10.2026):
// текст мамы не уходит во второй сервис. Не распознали — мама выбирает кнопками.
// Результат — только структура: дата, навык из справочника, статус. Маме показывается шаблонный текст автора.
import { normalizeText, stemTokens, stemsMatch } from './red-words'

export type CalendarStatus = 'start' | 'formed'
export type SkillRef = { id: number; name: string; synonyms: string[] }
export type CalendarDraft = { skillId?: number; status?: CalendarStatus; day?: string }

/**
 * Как говорят мамы — стартовый список на утверждение автору (ТЗ 9.7). Автор правит его в админке
 * («Навыки» → «Как говорят мамы»); пустое поле — значит этот список.
 */
export const DEFAULT_SKILL_SYNONYMS: Record<string, string[]> = {
  'держит голову': ['держит голову', 'держит головку', 'голову держит', 'головку держит'],
  улыбка: ['улыбается', 'улыбнулся', 'улыбнулась', 'улыбка'],
  гуление: ['гулит', 'гуление', 'агукает', 'гукает'],
  переворот: ['перевернулся', 'перевернулась', 'переворачивается', 'переворот'],
  'опора на ладони': ['опирается на ладони', 'опирается на руки', 'на вытянутых руках', 'опора на ладони'],
  ползание: ['пополз', 'поползла', 'ползает', 'ползет', 'ползание'],
  сел: ['сел', 'села', 'сидит', 'садится'],
  'встал у опоры': ['встал', 'встала', 'встает', 'стоит у опоры'],
  'первые шаги': ['первые шаги', 'первый шаг', 'шагнул', 'шагнула'],
  'пошёл уверенно': ['пошел', 'пошла', 'ходит сам', 'ходит сама'],
  лепет: ['лепечет', 'лепет', 'слоги'],
  'указательный жест': ['показывает пальцем', 'показывает пальчиком', 'указывает', 'указательный жест'],
}

export function skillPhrases(s: SkillRef): string[] {
  const own = s.synonyms.map((x) => x.trim()).filter(Boolean)
  return [s.name, ...(own.length ? own : (DEFAULT_SKILL_SYNONYMS[s.name.toLowerCase()] ?? []))]
}

/**
 * Навык из справочника: фраза совпала, если все её слова есть в тексте (с учётом форм).
 * Побеждает самая длинная фраза; два разных навыка с равным счётом — не угадываем.
 */
export function findSkill(text: string, skills: SkillRef[]): number | undefined {
  const words = stemTokens(text)
  let best: { id: number; score: number } | undefined
  let tie = false
  for (const s of skills) {
    for (const phrase of skillPhrases(s)) {
      const stems = stemTokens(phrase).filter((x) => x.length >= 2)
      if (!stems.length || !stems.every((p) => words.some((w) => stemsMatch(w, p)))) continue
      const score = stems.join('').length
      if (!best || score > best.score) {
        tie = false
        best = { id: s.id, score }
      } else if (score === best.score && best.id !== s.id) tie = true
    }
  }
  return best && !tie ? best.id : undefined
}

const START = /(^| )(неуверенн\S*|пока|начал\S*|начина\S*|пробу\S*|пыта\S*|впервые|первый раз|старт\S*|немного|чуть)( |$)/
const FORMED = /(^| )(уверенн\S*|сформирова\S*|свободно|отлично|хорошо|научил\S*|освоил\S*|стабильно|всегда)( |$)/

/** Статус: «старт навыка» или «навык сформирован». Есть оба признака — не угадываем. */
export function findStatus(text: string): CalendarStatus | undefined {
  const t = ` ${normalizeText(text).join(' ')} `
  const start = START.test(t)
  const formed = FORMED.test(t.replace(/ неуверенн\S*/g, ' '))
  if (start && !formed) return 'start'
  if (formed && !start) return 'formed'
  return undefined
}

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
const WEEKDAYS = ['понедельник', 'вторник', 'сред', 'четверг', 'пятниц', 'суббот', 'воскресен']

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromKey = (k: string) => new Date(`${k}T12:00:00Z`)
export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setUTCDate(d.getUTCDate() + n)
  return toKey(d)
}

function validDay(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? toKey(date) : undefined
}

/** Число и месяц без года — в прошлом относительно сегодня: «15 ноября» в январе — прошлогоднее. */
function pastDay(today: string, m: number, d: number): string | undefined {
  const y = Number(today.slice(0, 4))
  const day = validDay(y, m, d)
  if (!day) return undefined
  return day > today ? validDay(y - 1, m, d) : day
}

/** Дата: «сегодня», «вчера», «позавчера», «15 ноября», «15.11», «в пятницу». `today` — YYYY-MM-DD по времени мамы. */
export function findDay(text: string, today: string): string | undefined {
  const t = normalizeText(text)
  if (t.includes('позавчера')) return addDays(today, -2)
  if (t.includes('вчера')) return addDays(today, -1)
  if (t.includes('сегодня')) return today
  const num = /(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/.exec(text)
  if (num) {
    const [d, m, y] = [Number(num[1]), Number(num[2]), num[3] ? Number(num[3]) : undefined]
    if (y) return validDay(y < 100 ? 2000 + y : y, m, d)
    return pastDay(today, m, d)
  }
  for (let i = 0; i < t.length - 1; i++) {
    const d = Number(t[i])
    const m = MONTHS.findIndex((p) => (p === 'ма' ? /^ма[йя]$/.test(t[i + 1]!) : t[i + 1]!.startsWith(p)))
    if (Number.isInteger(d) && d >= 1 && d <= 31 && m >= 0) return pastDay(today, m + 1, d)
  }
  const wd = WEEKDAYS.findIndex((p) => t.some((w) => w.startsWith(p)))
  if (wd >= 0) {
    const todayWd = (fromKey(today).getUTCDay() + 6) % 7
    return addDays(today, -((todayWd - wd + 7) % 7))
  }
  return undefined
}

export function parseCalendarText(text: string, skills: SkillRef[], today: string): CalendarDraft {
  return { skillId: findSkill(text, skills), status: findStatus(text), day: findDay(text, today) }
}

/** Дата записи: не в будущем и не раньше месяца рождения (если он известен). */
export function isValidCalendarDay(day: string, today: string, birth?: { year: number; month: number } | null): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !validDay(Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10)))) return false
  if (day > today) return false
  if (birth && day < `${birth.year}-${pad(birth.month)}-01`) return false
  return day >= addDays(today, -3 * 366)
}

/** 15.11.2026 — для подтверждения «Записала: 15.11 — …». */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split('-')
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}`
}
