// Шаблон упражнения (ТЗ 9.2) в .docx: автор открывает его в Яндекс Документах, заполняет и выгружает обратно в .docx.
// Запуск: corepack pnpm -F @mama/web exec tsx scripts/docx-template.ts → apps/web/public/admin-files/shablon-uprazhneniya.docx
// Та же функция собирает документ-образец для теста импорта.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx'

type Sample = {
  title: string
  meta: [string, string][]
  steps: string[]
  sections: [string, string][]
}

const TEMPLATE: Sample = {
  title: 'Название упражнения',
  meta: [
    ['Тип', 'Упражнение'],
    ['Возраст', '4–9 месяцев'],
    ['Теги', 'Развитие, Ползание'],
    ['Ведёт к', 'Ползание'],
    ['Нужно уметь', 'Опора на ладони'],
    ['Время', '5 минут'],
    ['Доступ', 'бесплатно'],
    ['Лента', 'да'],
    ['Анонс', '2–3 строки, которые придут в ленте'],
  ],
  steps: ['Что делать на первом шаге (1–3 строки).', 'Что делать на втором шаге.', 'Шагов от 2 до 6.'],
  sections: [
    ['Как понять, что получается', '1–2 строки.'],
    ['Если не получается', 'Успокаивающий текст. Необязательно.'],
    ['Облегчённый вариант', 'Необязательно.'],
    ['Когда показать врачу', 'Необязательно.'],
  ],
}

export async function buildDocx(sample: Sample = TEMPLATE, image?: Buffer): Promise<Buffer> {
  const img = () =>
    image
      ? [new Paragraph({ children: [new ImageRun({ type: 'png', data: image, transformation: { width: 240, height: 180 } })] })]
      : [new Paragraph({ children: [new TextRun({ text: '[вставьте картинку]', italics: true })] })]
  const children = [
    new Paragraph({ children: [new TextRun({ text: 'Название: ', bold: true }), new TextRun(sample.title)] }),
    ...sample.meta.map(([k, v]) => new Paragraph({ children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(v)] })),
    new Paragraph({ text: 'Обложка', heading: HeadingLevel.HEADING_2 }),
    ...img(),
    ...sample.steps.flatMap((text, i) => [
      new Paragraph({ text: `Шаг ${i + 1}`, heading: HeadingLevel.HEADING_2 }),
      ...img(),
      new Paragraph(text),
    ]),
    ...sample.sections.flatMap(([h, text]) => [new Paragraph({ text: h, heading: HeadingLevel.HEADING_2 }), new Paragraph(text)]),
  ]
  return Packer.toBuffer(new Document({ sections: [{ children }] }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/admin-files/shablon-uprazhneniya.docx')
  await writeFile(out, await buildDocx())
  console.log(`Шаблон: ${out}`)
}
