'use client'
import { fmt } from '@mama/shared/texts'
import { invoice } from '@telegram-apps/sdk-react'
import { Button, Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SubscriptionPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { haptic } from '../telegram'
import { Loading, Message } from '../ui'

const dateRu = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

type PayResult = { kind: 'done'; endsAt: string } | { kind: 'invoice'; link: string }

/** Экран «Подписка» (ТЗ 8.1, п. 11, 8.6): что входит, цена, оплата, статус и срок. */
export function SubscriptionScreen() {
  const { initData, session } = useApp()
  const t = session.texts
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['subscription'], queryFn: () => api<SubscriptionPayload>('/api/tma/subscription', initData) })

  const pay = useMutation({
    mutationFn: async (planId: string) => {
      const r = await api<PayResult>('/api/tma/subscription/pay', initData, { planId })
      if (r.kind === 'invoice') {
        // TODO(Р21): Telegram Stars — подтверждение придёт боту, доступ откроется после него.
        const status = await invoice.open(r.link, 'url')
        if (status !== 'paid') return
        // Бот обрабатывает оплату в фоне — даём ему пару секунд (ТЗ 8.6: доступ ≤ 1 мин).
        await new Promise((ok) => setTimeout(ok, 2000))
      }
    },
    onSuccess: () => {
      haptic((h) => h.notificationOccurred('success'))
      // Закрытые материалы открываются сразу: сбрасываем всё, где могли быть замки.
      void qc.invalidateQueries()
    },
  })

  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  const s = q.data
  const siteUrl = window.location.origin

  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.subscriptionTitle}</h1>
      <Section>
        <Cell multiline>{s.status?.active ? fmt(t.subscriptionActive, { date: dateRu(s.status.endsAt) }) : t.subscriptionNone}</Cell>
        <Cell multiline>{s.description}</Cell>
      </Section>
      {s.provider === null ? (
        <Message text={t.subscriptionDisabled} />
      ) : (
        <Section footer={s.provider === 'test' ? t.subscriptionTestMode : undefined}>
          {s.plans.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <p className="pb-2 text-[17px]">
                {fmt(t.subscriptionPlan, {
                  period: p.title,
                  price: s.provider === 'stars' ? `${p.priceStars} ⭐` : `${p.priceRub} ₽`,
                })}
              </p>
              <Button size="l" stretched loading={pay.isPending && pay.variables === p.id} onClick={() => pay.mutate(p.id)}>
                {t.subscriptionPay}
              </Button>
            </div>
          ))}
          <p
            className="px-4 pb-3 text-[13px] opacity-70 [&_a]:text-[var(--app-link)]"
            // Ссылка на оферту — из текста автора; кроме <a> там ничего нет.
            dangerouslySetInnerHTML={{ __html: fmt(t.subscriptionOffer, { siteUrl }) }}
          />
        </Section>
      )}
      {pay.isError && <p className="px-4 text-red-600">{t.loadError}</p>}
    </List>
  )
}
