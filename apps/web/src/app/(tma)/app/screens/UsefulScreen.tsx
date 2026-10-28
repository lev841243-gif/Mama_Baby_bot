'use client'
import { Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import type { UsefulPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { Loading, Message } from '../ui'
import { openExternal } from './MusicScreen'

/** «Полезное» (ТЗ 8.7): консультации, курсы, книги — только ссылки, без продаж внутри приложения. */
export function UsefulScreen() {
  const { initData, session } = useApp()
  const t = session.texts
  const q = useQuery({ queryKey: ['useful'], queryFn: () => api<UsefulPayload>('/api/tma/useful', initData) })
  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.usefulTitle}</h1>
      <Section footer={t.usefulNote}>
        {q.data.links.length === 0 && <Cell multiline>{t.usefulEmpty}</Cell>}
        {q.data.links.map((l) => (
          <Cell key={l.id} multiline subtitle={l.description || undefined} after="↗" onClick={() => openExternal(l.url)}>
            {l.title}
          </Cell>
        ))}
      </Section>
    </List>
  )
}
