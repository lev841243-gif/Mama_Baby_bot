'use client'
import { Button, Cell, Input, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { SearchPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Disclaimer } from '../ui'

/** Текст автора с <b>/<i> (экстренный текст): всё остальное экранируется. */
function authorHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>')
    .replace(/\n/g, '<br>')
}

/** Поиск по материалам автора (ТЗ 10.1): только материалы, своего текста нет; «красные слова» — экстренный текст. */
export function SearchScreen() {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const [q, setQ] = useState('')
  const [wanted, setWanted] = useState<'pick' | 'done' | null>(null)
  const search = useMutation({
    mutationFn: (query: string) => api<SearchPayload>('/api/tma/search', initData, { q: query }),
    onMutate: () => setWanted(null),
  })
  const want = useMutation({
    mutationFn: (topic: string) => api('/api/tma/wanted', initData, { topic }),
    onSuccess: () => setWanted('done'),
  })
  const r = search.data

  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.searchTitle}</h1>
      <form
        className="flex items-end gap-2 px-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) search.mutate(q.trim())
        }}
      >
        <div className="flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} enterKeyHint="search" maxLength={200} />
        </div>
        <Button type="submit" size="m" loading={search.isPending} className="mb-3">
          {t.searchGo}
        </Button>
      </form>

      {search.isError && <p className="px-4 text-red-600">{t.loadError}</p>}

      {r?.status === 'emergency' && (
        <div
          role="alert"
          className="mx-4 rounded-2xl p-4 text-[17px] leading-snug"
          style={{ background: 'var(--app-secondary-bg)' }}
          dangerouslySetInnerHTML={{ __html: authorHtml(r.text) }}
        />
      )}

      {r?.status === 'limit' && <p className="px-4">{t.searchLimit}</p>}

      {r?.status === 'ok' && (
        <Section header={t.searchResults}>
          {r.results.map((c) => (
            <CardCell key={c.id} card={c} t={t} onClick={() => nav.push({ name: 'material', id: c.id })} />
          ))}
        </Section>
      )}

      {r?.status === 'nothing' && (
        <Section header={t.searchNothing}>
          {wanted === null && (
            <div className="px-4 py-3">
              <Button size="m" mode="bezeled" stretched onClick={() => setWanted('pick')}>
                {t.searchWant}
              </Button>
            </div>
          )}
          {wanted === 'pick' && (
            <>
              <Cell multiline>{t.searchWantPick}</Cell>
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {r.topics.map((topic) => (
                  <Button key={topic} size="s" mode="bezeled" disabled={want.isPending} onClick={() => want.mutate(topic)}>
                    {topic}
                  </Button>
                ))}
              </div>
            </>
          )}
          {wanted === 'done' && <Cell multiline>{t.searchWantThanks}</Cell>}
        </Section>
      )}
      <Disclaimer text={t.medicalDisclaimer} />
    </List>
  )
}
