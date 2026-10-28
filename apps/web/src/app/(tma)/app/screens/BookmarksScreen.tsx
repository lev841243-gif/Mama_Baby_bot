'use client'
import { Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import type { BookmarksPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Loading, Message } from '../ui'

/** Закладки (ТЗ 8.1): материал в архиве — «Материал больше недоступен». */
export function BookmarksScreen() {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const q = useQuery({ queryKey: ['bookmarks'], queryFn: () => api<BookmarksPayload>('/api/tma/bookmarks', initData) })
  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.bookmarksTitle}</h1>
      <Section>
        {q.data.items.length === 0 && <Cell multiline>{t.bookmarksEmpty}</Cell>}
        {q.data.items.map((item) =>
          'unavailable' in item ? (
            <Cell key={item.id} multiline onClick={() => nav.push({ name: 'material', id: item.id })} style={{ opacity: 0.6 }}>
              {t.unavailable}
            </Cell>
          ) : (
            <CardCell key={item.id} card={item} t={t} onClick={() => nav.push({ name: 'material', id: item.id })} />
          ),
        )}
      </Section>
    </List>
  )
}
