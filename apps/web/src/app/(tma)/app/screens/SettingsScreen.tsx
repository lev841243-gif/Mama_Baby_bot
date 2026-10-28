'use client'
import { fmt } from '@mama/shared/texts'
import { Cell, List, Section, Switch } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SubscriptionPayload } from '@/lib/tma-types'
import { api } from '../api'
import { AgeSection } from '../AgePicker'
import { Confirm } from '../Confirm'
import { useApp } from '../nav'

/** Настройки (ТЗ 8.1, п. 12): возраст малыша, лента, закладки, шрифт, «Мои согласия», отзыв согласия. */
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
        <Cell onClick={() => nav.push({ name: 'feed' })}>{t.feedButton}</Cell>
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
