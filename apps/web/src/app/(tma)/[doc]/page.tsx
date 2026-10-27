import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import { notFound } from 'next/navigation'

// Публичные страницы юр. документов (ТЗ, приложение): [САЙТ]/terms, /privacy и т.д.
// Источник — черновики yuridicheskie-shablony/. Страницы собираются при сборке.
// TODO(шаг 3): тексты и версии — из админки.
const DOCS: Record<string, string> = {
  consent: '01-soglasie-na-obrabotku-pd.md',
  privacy: '02-politika-obrabotki-pd.md',
  rassylka: '03-soglasie-na-rassylku.md',
  'news-consent': '03-soglasie-na-rassylku.md',
  'calendar-consent': '04-soglasie-kalendar-navykov.md',
  oferta: '05-oferta-podpiska.md',
  terms: '06-polzovatelskoe-soglashenie.md',
}

export const dynamicParams = false
export const dynamic = 'force-static'

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }))
}

/** Убираем служебные пометки «Юристу» и «Черновик для экспертизы» — маме они не нужны. */
function stripNotes(md: string): string {
  return md
    .split(/\n\s*\n/)
    .filter((block) => !(block.trimStart().startsWith('>') && /Юристу|Черновик/.test(block)))
    .join('\n\n')
}

export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  const file = DOCS[doc]
  if (!file) notFound()
  const md = await readFile(path.join(process.cwd(), '../../yuridicheskie-shablony', file), 'utf8')
  const html = await marked.parse(stripNotes(md))
  return <main className="doc" dangerouslySetInnerHTML={{ __html: html }} />
}
