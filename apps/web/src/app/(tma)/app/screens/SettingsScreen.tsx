'use client'
import { birthYearOptions, isValidBirth } from '@mama/shared/age'
import { MONTHS_RU, fmt } from '@mama/shared/texts'
import { Button, Cell, List, Section, Switch } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Birth, HomePayload, SubscriptionPayload } from '@/lib/tma-types'
import { api } from '../api'
import { Confirm } from '../Confirm'
import { useApp } from '../nav'

/** Настройки (ТЗ 8.1, п. 12): возраст малыша, закладки, шрифт, «Мои согласия», отзыв согласия. */
export function SettingsScreen({ onDeleted, fontLarge, setFontLarge }: { onDeleted: () => void; fontLarge: boolean; setFontLarge: (v: boolean) => void }) {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const [confirming, setConfirming] = useState(false)
  // При оплаченной подписке — предупреждение, что доступ прекратится (ТЗ 6.5).
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<SubscriptionPayload>('/api/tma/subscription', initData),
    enabled: confirming,
  })
  const paidUntil = sub.data?.status?.active ? new Date(sub.data.status.endsAt).toLocaleDateString('ru-RU') : null
  const revokeAll = useMutation({
    mutationFn: () => api<{ status: 'deleted' }>('/api/tma/revoke', initData),
    onSuccess: onDeleted,
  })

  return (
    <List>
      <h1 className="px-4 pt-2 text-xl font-semibold">{t.appSettingsTitle}</h1>
      <AgeSection />
      <Section>
        <Cell onClick={() => nav.push({ name: 'bookmarks' })}>{t.bookmarksTitle}</Cell>
        <Cell onClick={() => nav.push({ name: 'subscription' })}>{t.subscriptionButton}</Cell>
        <Cell Component="label" after={<Switch checked={fontLarge} onChange={(e) => setFontLarge(e.target.checked)} />}>
          {t.fontBigger}
        </Cell>
      </Section>
      <Section>
        <Cell onClick={() => nav.push({ name: 'consents' })}>{t.myConsentsButton}</Cell>
        <Cell onClick={() => setConfirming(true)} style={{ color: 'var(--tg-theme-destructive-text-color, #e53935)' }}>
          {t.appRevokeAll}
        </Cell>
      </Section>
      {confirming && (
        <Confirm
          text={t.revokeConfirm}
          note={paidUntil ? fmt(t.revokeSubscription, { date: paidUntil, siteUrl: window.location.origin }).replace(/<[^>]+>/g, '') : undefined}
          okText={t.revokeYes}
          cancelText={t.revokeNo}
          loading={revokeAll.isPending}
          onOk={() => revokeAll.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
      {revokeAll.isError && <p className="px-4 text-sm text-red-600">Не получилось удалить. Попробуйте ещё раз.</p>}
    </List>
  )
}

/** Месяц и год рождения кнопками, только по желанию (ТЗ 6.3). Точная дата не спрашивается. */
function AgeSection() {
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
    },
  })
  const birth = home.data?.birth ?? null

  return (
    <Section header={t.ageInApp} footer={t.ageInAppHint}>
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
