/// <reference path="./snowball.d.ts" />
import { distance } from 'fastest-levenshtein'
import * as snowball from 'snowball-stemmers'

// «Красные слова» (ТЗ 10.3). Список и экстренный текст ведёт автор в админке; здесь — стартовый
// список на утверждение автору (50+ слов и фраз) и текст по умолчанию из шаблона 07 §4.

export type RedWordsConfig = {
  words: string[]
  emergencyText: string
}

export const DEFAULT_EMERGENCY_TEXT =
  'Если ребёнку сейчас плохо — звоните <b>103</b> (скорая с мобильного) или <b>112</b>.\n\nБот не может оценить состояние малыша. При температуре, затруднённом дыхании, судорогах, травме или подозрении на отравление нужна помощь врача.'

/** Стартовый список. Лишнее срабатывание допустимо, пропуск — нет. */
export const DEFAULT_RED_WORDS = [
  // Температура и инфекции
  'температура', 'высокая температура', 'жар', 'лихорадка', 'горячий лоб', 'озноб', 'менингит',
  // Дыхание
  'не дышит', 'задыхается', 'задыхаться', 'одышка', 'хрипит', 'свистит при дыхании', 'посинел',
  'синеет', 'синие губы', 'подавился', 'поперхнулся', 'захлебнулся', 'утонул', 'ложный круп', 'лающий кашель',
  // Сознание и судороги
  'судороги', 'судорога', 'припадок', 'эпилепсия', 'закатывает глаза', 'трясётся', 'без сознания',
  'потерял сознание', 'обморок', 'не просыпается', 'вялый', 'обмяк',
  // Травмы
  'упал', 'ударился головой', 'травма', 'перелом', 'вывих', 'ожог', 'обжёгся', 'ударило током',
  'укусила собака', 'укус', 'кровь', 'кровотечение', 'шишка на голове',
  // Отравления и проглоченное
  'отравление', 'отравился', 'проглотил', 'батарейка', 'магнит', 'таблетки', 'съел лекарство',
  'бытовая химия', 'рвота', 'рвёт', 'фонтаном', 'понос', 'кровь в стуле',
  // Обезвоживание и прочее
  'обезвоживание', 'не писает', 'не мочится', 'сухой подгузник', 'запал родничок', 'выбухает родничок',
  'сыпь', 'не исчезает при надавливании', 'отёк', 'отек квинке', 'аллергия', 'опухло горло',
  'не ест сутки', 'кричит не переставая', 'резкая боль', 'скорая помощь', 'вызвать скорую',
  // Состояние мамы
  'не хочу жить', 'покончить с собой', 'суицид', 'причинить вред ребёнку', 'ударить ребёнка',
  'послеродовая депрессия',
]

// ---------- Поиск «красных слов» в тексте ----------
// Слово находится с учётом форм (стеммер) и типичных опечаток (расстояние Левенштейна).
// Лишнее срабатывание допустимо, пропуск — нет (ТЗ 10.3), поэтому сравнение нарочно мягкое.


// CommonJS-модуль: в разных сборщиках он приходит то как default, то как сам объект.
const factory = (snowball as unknown as { default?: typeof snowball }).default ?? snowball
const stemmer = factory.newStemmer('russian')

export function normalizeText(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/i)
    .filter(Boolean)
}

const stem = (w: string) => stemmer.stem(w)

/** Основы слов текста (русский стеммер) — и для «красных слов», и для разбора записи календаря. */
export const stemTokens = (s: string) => normalizeText(s).map(stem)

// Частые безопасные слова, которые иначе ловились бы по началу: «кроватка» ≠ «кровь».
const SAFE_PREFIXES = ['кроват']

/** Совпадают ли два слова (основы) с учётом форм и опечаток. */
export function stemsMatch(textStem: string, redStem: string): boolean {
  if (textStem === redStem) return true
  if (SAFE_PREFIXES.some((p) => textStem.startsWith(p))) return false
  const min = Math.min(textStem.length, redStem.length)
  const max = Math.max(textStem.length, redStem.length)
  // «температур» ↔ «температурк», «отрав» ↔ «отравлен».
  if (redStem.length >= 3 && textStem.startsWith(redStem)) return true
  if (textStem.length >= 4 && redStem.startsWith(textStem)) return true
  // Опечатки: в основах от 6 букв — одна, от 9 — две. Короче — только точно: «перед» ≠ «перелом».
  if (min < 6) return false
  return distance(textStem, redStem) <= (max >= 9 ? 2 : 1)
}

type Compiled = { phrase: string; stems: string[] }[]
let compiledFor: string[] | undefined
let compiled: Compiled = []

function compile(words: string[]): Compiled {
  if (compiledFor === words) return compiled
  compiledFor = words
  compiled = words
    .map((phrase) => ({ phrase, stems: normalizeText(phrase).map(stem) }))
    .filter((p) => p.stems.length > 0)
  return compiled
}

// Слова фразы идут по порядку, между ними — не больше двух других слов («не очень хорошо дышит»).
const MAX_GAP = 2

/** Первая найденная фраза из списка или null. */
export function findRedWord(text: string, words: string[]): string | null {
  const tokens = normalizeText(text).map(stem)
  if (tokens.length === 0) return null
  for (const { phrase, stems } of compile(words)) {
    for (let start = 0; start < tokens.length; start++) {
      if (!stemsMatch(tokens[start]!, stems[0]!)) continue
      let pos = start
      let ok = true
      for (const s of stems.slice(1)) {
        let found = -1
        for (let j = pos + 1; j <= Math.min(tokens.length - 1, pos + 1 + MAX_GAP); j++) {
          if (stemsMatch(tokens[j]!, s)) {
            found = j
            break
          }
        }
        if (found < 0) {
          ok = false
          break
        }
        pos = found
      }
      if (ok) return phrase
    }
  }
  return null
}
