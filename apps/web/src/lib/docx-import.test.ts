// Импорт .docx по шаблону (приёмка 7). Запуск: corepack pnpm -F @mama/web test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDocx } from '../../scripts/docx-template'
import { blocksToLexical, parseAge, parseDocx, parseHtml, parseTemplate, toBlocks } from './docx-import'

// 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('упражнение из .docx по шаблону раскладывается по полям', async () => {
  const docx = await buildDocx(
    {
      title: 'Переворот с игрушкой',
      meta: [
        ['Тип', 'Упражнение'],
        ['Возраст', '4–9 месяцев'],
        ['Теги', 'Развитие, Гимнастика и упражнения'],
        ['Ведёт к', 'Переворот'],
        ['Время', '5 минут'],
        ['Доступ', 'по подписке'],
        ['Лента', 'да'],
        ['Анонс', 'Помогаем малышу перевернуться.'],
      ],
      steps: ['Положите малыша на спину.', 'Покажите игрушку сбоку.'],
      sections: [
        ['Как понять, что получается', 'Малыш тянется за игрушкой.'],
        ['Если не получается', 'Это нормально.'],
        ['Когда показать врачу', 'Если малыш не поворачивает голову.'],
      ],
    },
    PNG,
  )
  const m = await parseDocx(docx)
  assert.equal(m.title, 'Переворот с игрушкой')
  assert.equal(m.type, 'exercise')
  assert.deepEqual([m.ageFrom, m.ageTo], [4, 9])
  assert.deepEqual(m.tags, ['Развитие', 'Гимнастика и упражнения'])
  assert.deepEqual(m.skillsLeadsTo, ['Переворот'])
  assert.equal(m.minutes, 5)
  assert.equal(m.access, 'paid')
  assert.equal(m.inFeed, true)
  assert.equal(m.announce, 'Помогаем малышу перевернуться.')
  assert.equal(m.images.length, 3, 'обложка и две картинки шагов')
  assert.equal(m.cover, 0)
  assert.deepEqual(m.steps, [
    { text: 'Положите малыша на спину.', image: 1 },
    { text: 'Покажите игрушку сбоку.', image: 2 },
  ])
  assert.equal(m.howToKnow, 'Малыш тянется за игрушкой.')
  assert.equal(m.ifNotWorking, 'Это нормально.')
  assert.equal(m.whenToSeeDoctor, 'Если малыш не поворачивает голову.')
  assert.deepEqual(m.warnings, [])
})

test('незаполненный шаблон даёт предупреждения, а не ошибку', async () => {
  const m = await parseDocx(await buildDocx())
  assert.ok(m.warnings.some((w) => w.includes('нет картинки')))
})

test('статья: текст с подзаголовком, списком, жирным и ссылкой → Lexical', () => {
  const html =
    '<p>Название: Сон малыша</p><p>Тип: статья</p><p>Возраст: 6-12</p><p>Теги: Сон</p><p>Текст</p>' +
    '<h2>Ритуал</h2><p>Спокойно <strong>и тихо</strong>, <a href="https://t.me/detimam_pro">канал</a>.</p>' +
    '<ul><li>Купание</li><li>Колыбельная</li></ul><p><img src="img:0" /></p>'
  const m = parseTemplate(toBlocks(parseHtml(html)), [{ buffer: PNG, contentType: 'image/png', name: 'a.png' }])
  assert.equal(m.type, 'article')
  assert.deepEqual([m.ageFrom, m.ageTo], [6, 12])
  assert.deepEqual(m.warnings, [])
  const lex = blocksToLexical(m.body, [42]) as { root: { children: { type: string; children?: { format?: number; type: string }[] }[] } }
  assert.deepEqual(
    lex.root.children.map((c) => c.type),
    ['heading', 'paragraph', 'list', 'upload'],
  )
  const p = lex.root.children[1]!.children!
  assert.equal(p[1]!.format, 1, 'жирный')
  assert.equal(p[3]!.type, 'link')
})

test('возраст «от–до»: верх больше низа и не выше 18', () => {
  assert.deepEqual(parseAge('от 3 до 6 мес.'), { from: 3, to: 6 })
  assert.equal(parseAge('9–6'), null)
  assert.equal(parseAge('12–24'), null)
  assert.equal(parseAge('6'), null)
})
