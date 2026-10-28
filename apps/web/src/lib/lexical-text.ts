/** Простой текст из документа Lexical: время чтения, поиск, анонс. */
export function lexicalPlainText(state: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: unknown; children?: unknown[] }
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.children)) {
      n.children.forEach(walk)
      if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem') out.push('\n')
    }
  }
  walk((state as { root?: unknown } | null)?.root)
  return out.join('').replace(/\n{2,}/g, '\n').trim()
}
