'use client'
import { ageInMonths } from '@mama/shared/age'
import {
  FEED_MAX_MONTHS,
  FEED_MIN_MONTHS,
  FEED_PAUSE_DAYS,
  RU_TIMEZONES,
  isRuTimezone,
  timesLabel,
  timezoneLabel,
  type FeedSlot,
} from '@mama/shared/feed-types'
import { fmt } from '@mama/shared/texts'
import { openLink } from '@telegram-apps/sdk-react'
import { Button, Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FeedPayload } from '@/lib/tma-types'
import { AgeSection } from '../AgePicker'
import { api } from '../api'
import { Confirm } from '../Confirm'
import { useApp } from '../nav'
import { haptic } from '../telegram'
import { Loading, Message } from '../ui'

type Action =
  | { action: 'subscribe'; slot: FeedSlot; timezone?: string }
  | { action: 'slot'; slot: FeedSlot }
  | { action: 'tz'; timezone: string }
  | { action: 'pause'; days: (typeof FEED_PAUSE_DAYS)[number] }
  | { action: 'resume' }
  | { action: 'unsubscribe' }

/** Пояс устройства, если он из списка РФ, — подставляется при подписке; мама может поменять. */
function deviceTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isRuTimezone(tz) ? tz : undefined
  } catch {
    return undefined
  }
}

/** Лента (ТЗ 7, 8.1): подписка с возрастом и временем, время, часовой пояс, пауза, отписка. */
export function FeedScreen() {
  const { initData, session } = useApp()
  const t = session.texts
  const qc = useQueryClient()
  const [offerAccepted, setOfferAccepted] = useState(false)
  const [unsub, setUnsub] = useState(false)
  const [unsubDone, setUnsubDone] = useState(false)
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => api<FeedPayload>('/api/tma/feed', initData, null) })
  const act = useMutation({
    mutationFn: (a: Action) => api<FeedPayload>('/api/tma/feed', initData, a),
    onSuccess: (next, a) => {
      haptic((h) => h.notificationOccurred.ifAvailable('success'))
      setUnsub(false)
      setUnsubDone(a.action === 'unsubscribe')
      if (a.action === 'unsubscribe') setOfferAccepted(false)
      qc.setQueryData(['feed'], next)
      void qc.invalidateQueries({ queryKey: ['home'] })
      void qc.invalidateQueries({ queryKey: ['session'] })
    },
  })

  if (feed.isPending) return <Loading />
  if (feed.error) return <Message text={t.loadError} />
  const st = feed.data.state
  const times = timesLabel(st.perWeek)
  const slots: [FeedSlot, string][] = [
    ['morning', t.feedSlotMorning],
    ['day', t.feedSlotDay],
    ['evening', t.feedSlotEvening],
  ]
  const months = st.birth ? ageInMonths(st.birth.year, st.birth.month) : null
  const tooOld = months !== null && months >= FEED_MAX_MONTHS

  const openTerms = () => {
    const url = new URL('/rassylka', window.location.origin).toString()
    try {
      openLink(url)
    } catch {
      window.open(url, '_blank')
    }
  }

  const header = <h1 className="px-4 pt-2 text-xl font-semibold">{t.feedButton}</h1>

  // Не подписана: предложение (шаблон 07 §5).
  if (!st.consent && !offerAccepted) {
    return (
      <List>
        {header}
        {unsubDone && <p className="px-4 text-[15px] leading-snug">{t.feedUnsubDone}</p>}
        <p className="px-4 text-[15px] leading-snug">{fmt(t.feedOffer, { times })}</p>
        <div className="px-4">
          <button type="button" className="text-sm underline" style={{ color: 'var(--app-link)' }} onClick={openTerms}>
            {t.feedTermsLink}
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 pt-2">
          <Button size="l" stretched onClick={() => setOfferAccepted(true)}>
            {t.feedSubscribe}
          </Button>
        </div>
      </List>
    )
  }

  // Подписка: возраст (если нет), затем время (ТЗ 6.3, 7). Согласие пишется вместе с выбором времени.
  if (!st.settings) {
    return (
      <List>
        {header}
        {st.consent && <p className="px-4 text-[15px] leading-snug">{t.feedSetupNeeded}</p>}
        {!st.birth ? (
          <AgeSection header={t.feedAskAge} footer="" />
        ) : tooOld ? (
          <Message text={t.feedTooOld} />
        ) : (
          <Section header={t.feedAskSlot}>
            {slots.map(([id, label]) => (
              <Cell key={id} disabled={act.isPending} onClick={() => act.mutate({ action: 'subscribe', slot: id, timezone: deviceTimezone() })}>
                {label}
              </Cell>
            ))}
          </Section>
        )}
        {act.isError && <p className="px-4 text-sm text-red-600">{t.loadError}</p>}
      </List>
    )
  }

  const { slot, timezone, pausedUntil } = st.settings
  const slotName = slots.find(([id]) => id === slot)?.[1] ?? slot
  const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { timeZone: timezone })
  const pauseLabels: Record<number, string> = { 7: t.feedPauseWeek, 14: t.feedPause2Weeks, 30: t.feedPauseMonth }

  return (
    <List>
      {header}
      <p className="px-4 text-[15px] leading-snug">
        {feed.data.result === 'ok'
          ? fmt(t.feedSubscribed, { times, slot: slotName, tz: timezoneLabel(timezone) })
          : pausedUntil
            ? fmt(t.feedStatusPaused, { date: date(pausedUntil) })
            : fmt(t.feedStatusOn, { slot: slotName, times, tz: timezoneLabel(timezone) })}
      </p>
      {months === null && <p className="px-4 text-[15px] opacity-80">{t.feedNeedAge}</p>}
      {months !== null && months < FEED_MIN_MONTHS && <p className="px-4 text-[15px] opacity-80">{t.feedWaitThree}</p>}
      {tooOld && <p className="px-4 text-[15px] opacity-80">{t.feedTooOld}</p>}

      <Section header={t.feedTimeButton}>
        {slots.map(([id, label]) => (
          <Cell
            key={id}
            disabled={act.isPending}
            after={id === slot ? '✓' : undefined}
            onClick={() => id !== slot && act.mutate({ action: 'slot', slot: id })}
          >
            {label}
          </Cell>
        ))}
      </Section>

      <Section header={t.feedTzButton}>
        <div className="px-4 py-2">
          <select
            className="w-full rounded-lg p-2 text-[15px]"
            style={{ background: 'var(--app-secondary-bg)', color: 'inherit' }}
            value={timezone}
            disabled={act.isPending}
            onChange={(e) => act.mutate({ action: 'tz', timezone: e.target.value })}
          >
            {RU_TIMEZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section header={pausedUntil ? undefined : t.feedAskPause}>
        {pausedUntil ? (
          <Cell disabled={act.isPending} onClick={() => act.mutate({ action: 'resume' })}>
            {t.feedResumeButton}
          </Cell>
        ) : (
          FEED_PAUSE_DAYS.map((days) => (
            <Cell key={days} disabled={act.isPending} onClick={() => act.mutate({ action: 'pause', days })}>
              {`${t.feedPauseButton}: ${pauseLabels[days]}`}
            </Cell>
          ))
        )}
      </Section>

      <Section>
        <Cell onClick={() => setUnsub(true)} style={{ color: 'var(--tg-theme-destructive-text-color, #e53935)' }}>
          {t.feedUnsubButton}
        </Cell>
      </Section>
      {unsub && (
        <Confirm
          text={t.feedUnsubConfirm}
          okText={t.feedUnsubYes}
          cancelText={t.revokeNo}
          loading={act.isPending}
          onOk={() => act.mutate({ action: 'unsubscribe' })}
          onCancel={() => setUnsub(false)}
        />
      )}
      {act.isError && <p className="px-4 text-sm text-red-600">{t.loadError}</p>}
    </List>
  )
}
