'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

type Line = { segments: { text: string; fromSource: boolean }[]; clean: boolean }
type Result = { title: Line[]; announce: Line[]; body: Line[]; posts: number } | null

/**
 * Проверка статьи, собранной из постов (ТЗ 9.9, приёмка 32): жёлтым — текст, которого нет в постах.
 * Показывается только у материалов с источниками.
 */
export function SourceCheck() {
  const { id } = useDocumentInfo()
  const [res, setRes] = useState<Result>(null)

  useEffect(() => {
    if (!id) return
    void fetch(`/api/materials/${id}/source-check`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRes)
  }, [id])

  if (!res || res.posts === 0) return null
  const all = [...res.title, ...res.announce, ...res.body]
  const dirty = all.filter((l) => !l.clean).length
  const show = (label: string, lines: Line[]) =>
    lines.some((l) => !l.clean) && (
      <div style={{ marginBottom: 8 }}>
        <b>{label}</b>
        {lines
          .filter((l) => !l.clean)
          .map((l, i) => (
            <p key={i} style={{ margin: '4px 0' }}>
              {l.segments.map((s, j) =>
                s.fromSource ? <span key={j}>{s.text}</span> : <mark key={j} style={{ background: '#ffe58a', color: '#000' }}>{s.text}</mark>,
              )}
            </p>
          ))}
      </div>
    )

  return (
    <div style={{ marginBottom: 24, fontSize: 13 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Сверка с постами канала ({res.posts})</p>
      {dirty === 0 ? (
        <p style={{ margin: 0 }}>Весь текст есть в постах.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}>Текста нет в постах — {dirty} строк(и). Проверьте подсвеченное:</p>
          {show('Название', res.title)}
          {show('Анонс', res.announce)}
          {show('Текст', res.body)}
        </>
      )}
      <p style={{ margin: '8px 0 0', opacity: 0.7 }}>Сверка — по сохранённой версии. Ваши собственные правки тоже подсвечиваются.</p>
    </div>
  )
}
