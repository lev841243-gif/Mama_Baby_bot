import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'

// Памятка автору (ТЗ 9.5) — из docs/pamyatka-avtoru.md, собирается при сборке.
export const dynamic = 'force-static'

export default async function Pamyatka() {
  const md = await readFile(path.join(process.cwd(), '../../docs/pamyatka-avtoru.md'), 'utf8')
  return <main className="doc" dangerouslySetInnerHTML={{ __html: await marked.parse(md) }} />
}
