'use client'
import { birthYearOptions, isValidBirth } from '@mama/shared/age'
import { MONTHS_RU } from '@mama/shared/texts'
import { Button, Cell, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Birth, HomePayload } from '@/lib/tma-types'
import { api } from './api'
import { useApp } from './nav'

/** Месяц и год рождения кнопками, только по желанию (ТЗ 6.3). Точная дата не спрашивается. */
export function AgeSection({ header, footer }: { header?: string; footer?: string } = {}) {
  const { initData, session } = useApp()
  const t = session.texts
  const qc = useQueryClient()
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomePayload>('/api/tma/home', initData) })
  const [year, setYear] = useState<number | null>(null)
  const save = useMutation({
    mutationFn: (birth: Birth | null) => api('/api/tma/profile', initData, { birth }),
    onSuccess: () => {
      setYear(null)
      void qc.invalidateQueries({ queryKey: ['home'] })
      void qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
  const birth = home.data?.birth ?? null

  return (
    <Section header={header ?? t.ageInApp} footer={footer ?? t.ageInAppHint}>
      <Cell multiline subtitle={birth ? undefined : t.ageNotSet}>
        {birth ? `${MONTHS_RU[birth.month - 1]} ${birth.year}` : t.ageInApp}
      </Cell>
      <div className="flex flex-wrap gap-2 px-4 py-2">
        {birthYearOptions().map((y) => (
          <Button key={y} size="s" mode={year === y ? 'filled' : 'bezeled'} onClick={() => setYear(y)}>
            {y}
          </Button>
        ))}
        {birth && (
          <Button size="s" mode="plain" loading={save.isPending && !year} onClick={() => save.mutate(null)}>
            {t.ageClearButton}
          </Button>
        )}
      </div>
      {year && (
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          {MONTHS_RU.map((name, i) =>
            isValidBirth(year, i + 1) ? (
              <Button key={name} size="s" mode="bezeled" disabled={save.isPending} onClick={() => save.mutate({ year, month: i + 1 })}>
                {name}
              </Button>
            ) : null,
          )}
        </div>
      )}
    </Section>
  )
}
