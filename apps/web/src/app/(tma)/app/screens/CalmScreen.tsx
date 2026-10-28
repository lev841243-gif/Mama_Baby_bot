'use client'
import { Cell, List, Section, TabsList } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { CalmPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Disclaimer, Loading, Message } from '../ui'

/** «Спокойная мама» (ТЗ 8.1, п. 6): телесные и психологические практики с аудио. */
export function CalmScreen() {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const [tab, setTab] = useState<'body' | 'psy'>('body')
  const q = useQuery({ queryKey: ['calm'], queryFn: () => api<CalmPayload>('/api/tma/calm', initData) })
  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  const items = q.data[tab]
  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.calmMomTitle}</h1>
      <p className="px-4 text-[15px] opacity-80">{t.calmMomIntro}</p>
      <TabsList>
        <TabsList.Item selected={tab === 'body'} onClick={() => setTab('body')}>
          {t.tabBody}
        </TabsList.Item>
        <TabsList.Item selected={tab === 'psy'} onClick={() => setTab('psy')}>
          {t.tabPsy}
        </TabsList.Item>
      </TabsList>
      <Section>
        {items.length === 0 && <Cell multiline>{t.calmEmpty}</Cell>}
        {items.map((c) => (
          <CardCell key={c.id} card={c} t={t} onClick={() => nav.push({ name: 'material', id: c.id })} />
        ))}
      </Section>
      <Disclaimer text={t.medicalDisclaimer} />
    </List>
  )
}
