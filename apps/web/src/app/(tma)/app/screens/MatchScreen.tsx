'use client'
import { matchExercises, sectionsForRange } from '@mama/shared/content'
import { Button, Cell, Checkbox, List, Section } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { MatchPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { CardCell, Disclaimer, Loading, Message } from '../ui'

/**
 * «Что уже умеет малыш?» (ТЗ 8.3). Отметки живут только в этом экране: на сервер не уходят и нигде не
 * сохраняются (ТЗ 11.4, приёмка 12). Без оценок и сравнений — только упражнения автора (правило 3.4).
 */
export function MatchScreen() {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const q = useQuery({ queryKey: ['match'], queryFn: () => api<MatchPayload>('/api/tma/match', initData) })
  const [known, setKnown] = useState<Set<number>>(() => new Set())
  const [shown, setShown] = useState(false)

  const result = useMemo(() => (q.data ? matchExercises(q.data.exercises, known) : []), [q.data, known])

  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  const { skills, exercises, yourSection } = q.data
  // Ничего не подошло — упражнения раздела по возрасту (или все, если возраст не указан).
  const fallback = exercises.filter(
    (e) => !yourSection || (e.ageFrom !== null && e.ageTo !== null && sectionsForRange(e.ageFrom, e.ageTo).includes(yourSection)),
  )

  const toggle = (id: number) => {
    setShown(false)
    setKnown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.matchTitle}</h1>
      <p className="px-4 text-[15px] opacity-80">{t.matchIntro}</p>
      <Section>
        {skills.map((s) => (
          <Cell key={s.id} Component="label" before={<Checkbox checked={known.has(s.id)} onChange={() => toggle(s.id)} />}>
            {s.name}
          </Cell>
        ))}
      </Section>
      <div className="px-4">
        <Button size="l" stretched onClick={() => setShown(true)}>
          {t.matchShow}
        </Button>
      </div>
      {shown && (
        <Section header={result.length ? t.matchResult : t.matchEmpty}>
          {(result.length ? result : fallback).map((c) => (
            <CardCell key={c.id} card={c} t={t} onClick={() => nav.push({ name: 'material', id: c.id })} />
          ))}
        </Section>
      )}
      <Disclaimer text={t.medicalDisclaimer} />
    </List>
  )
}
