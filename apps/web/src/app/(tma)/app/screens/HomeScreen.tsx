'use client'
import { fmt } from '@mama/shared/texts'
import { Button, Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import type { HomePayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Disclaimer, Loading, Message } from '../ui'

/** Главная (ТЗ 8.1): разделы по возрасту с «ваш раздел», «Продолжить», «Новое от автора». */
export function HomeScreen() {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomePayload>('/api/tma/home', initData) })

  if (home.isPending) return <Loading />
  if (home.error) return <Message text={t.loadError} />
  const h = home.data
  const visible = h.sections.filter((s) => s.visible)

  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold leading-tight">{t.homeTitle}</h1>
      {h.tooYoung && <p className="px-4 text-[15px] opacity-80">{t.ageTooYoung}</p>}
      {h.feedSetup && (
        <Section>
          <Cell multiline onClick={() => nav.push({ name: 'feed' })} description={t.feedSetupButton}>
            {t.feedSetupNeeded}
          </Cell>
        </Section>
      )}

      {h.continue && (
        <Section header={t.homeContinue}>
          <CardCell card={h.continue} t={t} onClick={() => nav.push({ name: 'material', id: h.continue!.id })} />
        </Section>
      )}

      <div className="flex flex-col gap-2 px-4 pt-3">
        <Button size="l" stretched onClick={() => nav.push({ name: 'match' })}>
          {t.matchButton}
        </Button>
        <Button size="m" mode="bezeled" stretched onClick={() => nav.push({ name: 'search' })}>
          {t.searchButton}
        </Button>
      </div>

      <Section header={t.homeSections}>
        {visible.length === 0 && <Cell multiline>{t.homeEmpty}</Cell>}
        {visible.map((s) => (
          <Cell
            key={s.id}
            onClick={() => nav.push({ name: 'section', id: s.id })}
            subtitle={s.id === h.yourSection ? t.yourSection : undefined}
            style={s.id === h.yourSection ? { fontWeight: 600 } : undefined}
          >
            {fmt(t.sectionLabel, { from: String(s.from), to: String(s.to) })}
          </Cell>
        ))}
      </Section>

      {h.fresh.length > 0 && (
        <Section header={t.homeFresh}>
          {h.fresh.map((c) => (
            <CardCell key={c.id} card={c} t={t} onClick={() => nav.push({ name: 'material', id: c.id })} />
          ))}
        </Section>
      )}

      <Section>
        <Cell onClick={() => nav.push({ name: 'calm' })}>{t.calmMomButton}</Cell>
        <Cell onClick={() => nav.push({ name: 'music' })}>{t.musicButton}</Cell>
        <Cell onClick={() => nav.push({ name: 'useful' })}>{t.usefulButton}</Cell>
        <Cell onClick={() => nav.push({ name: 'subscription' })}>{t.subscriptionButton}</Cell>
      </Section>

      <div className="flex flex-wrap gap-2 px-4">
        <Button mode="bezeled" size="s" onClick={() => nav.push({ name: 'bookmarks' })}>
          {t.bookmarksTitle}
        </Button>
        <Button mode="bezeled" size="s" onClick={() => nav.push({ name: 'settings' })}>
          {t.settingsButton}
        </Button>
      </div>
      <Disclaimer text={t.medicalDisclaimer} />
    </List>
  )
}
