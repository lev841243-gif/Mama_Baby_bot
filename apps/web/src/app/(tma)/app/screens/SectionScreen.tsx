'use client'
import type { AgeSectionId } from '@mama/shared/age'
import { fmt } from '@mama/shared/texts'
import { Cell, List, Section, TabsList } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SectionPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Disclaimer, Loading, Message } from '../ui'

/** Раздел возраста (ТЗ 8.1): вкладки «Упражнения» и «Статьи». */
export function SectionScreen({ id }: { id: AgeSectionId }) {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const [tab, setTab] = useState<'exercises' | 'articles'>('exercises')
  const q = useQuery({ queryKey: ['section', id], queryFn: () => api<SectionPayload>('/api/tma/section', initData, { id }) })

  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  const { section, exercises, articles } = q.data
  const items = tab === 'exercises' ? exercises : articles

  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{fmt(t.sectionLabel, { from: String(section.from), to: String(section.to) })}</h1>
      <TabsList>
        <TabsList.Item selected={tab === 'exercises'} onClick={() => setTab('exercises')}>
          {t.tabExercises}
        </TabsList.Item>
        <TabsList.Item selected={tab === 'articles'} onClick={() => setTab('articles')}>
          {t.tabArticles}
        </TabsList.Item>
      </TabsList>
      <Section>
        {items.length === 0 && <Cell multiline>{t.sectionEmptyTab}</Cell>}
        {items.map((c) => (
          <CardCell key={c.id} card={c} t={t} onClick={() => nav.push({ name: 'material', id: c.id, section: id })} />
        ))}
      </Section>
      <Disclaimer text={t.medicalDisclaimer} />
    </List>
  )
}
