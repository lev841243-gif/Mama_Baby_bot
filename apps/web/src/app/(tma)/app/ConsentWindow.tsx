'use client'
import type { ConsentType } from '@mama/shared/consent-types'
import { openLink } from '@telegram-apps/sdk-react'
import { Button, Cell, Checkbox, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SessionPayload } from '@/lib/session-types'
import { api } from './api'
import { Confirm } from './Confirm'
import { useApp } from './nav'
import { haptic } from './telegram'

const linkStyle = { color: 'var(--tg-theme-link-color, #2481cc)' }

type Props = {
  session: SessionPayload
  initData: string
  /** first — окно при входе; manage — «Мои согласия» в настройках (ТЗ 8.9). */
  mode: 'first' | 'manage'
  onDeleted?: () => void
}

/**
 * Окно согласий (ТЗ 8.9). При входе: галочки сняты, «Принять всё» — только показанные пункты,
 * «Продолжить с выбранными» — только с основным согласием, «Не сейчас» ничего не отправляет.
 * В «Мои согласия»: галочки показывают текущие согласия, снять галочку — отозвать это согласие.
 */
export function ConsentWindow({ session, initData, mode, onDeleted }: Props) {
  const { items } = session.consent
  const t = session.texts
  const manage = mode === 'manage'
  const [checked, setChecked] = useState<Set<ConsentType>>(() => new Set(manage ? session.consent.granted : []))
  const [declined, setDeclined] = useState(false)
  const [revoking, setRevoking] = useState<ConsentType | null>(null)
  const queryClient = useQueryClient()
  const { nav } = useApp()

  const grant = useMutation({
    mutationFn: (types: ConsentType[]) => api<SessionPayload>('/api/tma/consents', initData, { types }),
    onSuccess: (next) => {
      haptic((h) => h.notificationOccurred.ifAvailable('success'))
      setChecked(new Set(next.consent.granted))
      queryClient.setQueryData(['session'], next)
      // Отмечена лента — сразу спрашиваем возраст и время (ТЗ 8.9).
      if (!manage && next.consent.granted.includes('feed')) nav.push({ name: 'feed' })
    },
  })

  const revoke = useMutation({
    mutationFn: (type: ConsentType) =>
      api<SessionPayload | { status: 'deleted' }>('/api/tma/consents/revoke', initData, { type }),
    onSuccess: (next) => {
      setRevoking(null)
      if (next.status === 'deleted') return onDeleted?.()
      setChecked(new Set(next.consent.granted))
      queryClient.setQueryData(['session'], next)
    },
  })

  const toggle = (type: ConsentType) => {
    haptic((h) => h.selectionChanged.ifAvailable())
    if (manage) {
      // Снять галочку — отозвать (с подтверждением), поставить — дать согласие сразу.
      if (checked.has(type)) setRevoking(type)
      else grant.mutate([...checked, type])
      return
    }
    setDeclined(false)
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const openDoc = (docPath: string) => {
    const url = new URL(docPath, window.location.origin).toString()
    try {
      openLink(url)
    } catch {
      window.open(url, '_blank')
    }
  }

  const busy = grant.isPending || revoke.isPending
  const revokingItem = items.find((i) => i.type === revoking)

  return (
    <List>
      {session.beta && <p className="px-4 pt-3 text-[13px] opacity-70">{t.betaConsent}</p>}
      <div className="px-4 pt-2">
        <h1 className="text-xl font-semibold">{manage ? t.myConsentsButton : t.consentTitle}</h1>
        <p className="mt-2 text-[15px] leading-snug opacity-80">{t.consentIntro}</p>
      </div>
      <Section>
        {items.map((item) => (
          <Cell
            key={item.type}
            Component="label"
            multiline
            before={<Checkbox checked={checked.has(item.type)} disabled={busy} onChange={() => toggle(item.type)} />}
            description={
              <>
                {item.hint}{' '}
                <button
                  type="button"
                  className="underline"
                  style={linkStyle}
                  onClick={(e) => {
                    e.preventDefault()
                    openDoc(item.docPath)
                  }}
                >
                  {t.consentDocLink}
                </button>
              </>
            }
          >
            {item.title}
          </Cell>
        ))}
      </Section>

      <div className="px-4">
        <button type="button" className="text-sm underline" style={linkStyle} onClick={() => openDoc('/privacy')}>
          {t.privacyLink}
        </button>
      </div>

      {revokingItem && (
        <Confirm
          text={t.consentRevokeItem.replace('{title}', revokingItem.title)}
          note={revokingItem.type === 'pd' ? t.consentRevokeItemPd : undefined}
          okText={t.consentRevokeOk}
          cancelText={t.revokeNo}
          loading={revoke.isPending}
          onOk={() => revoke.mutate(revokingItem.type)}
          onCancel={() => setRevoking(null)}
        />
      )}

      {!manage && (
        <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
          <Button
            size="l"
            stretched
            loading={grant.isPending}
            // Р27: пункты вне «Принять всё» принимаются, только если мама отметила их сама.
            onClick={() => grant.mutate(items.filter((i) => i.inAcceptAll || checked.has(i.type)).map((i) => i.type))}
          >
            {t.consentAcceptAll}
          </Button>
          <Button
            size="l"
            stretched
            mode="bezeled"
            disabled={!checked.has('pd') || busy}
            onClick={() => grant.mutate([...checked])}
          >
            {t.consentContinue}
          </Button>
          <Button size="l" stretched mode="plain" onClick={() => setDeclined(true)}>
            {t.consentNotNow}
          </Button>
          {declined && (
            <p role="status" className="px-2 text-center text-[15px] leading-snug opacity-80">
              {t.consentNotNowText}
            </p>
          )}
        </div>
      )}
      {(grant.isError || revoke.isError) && (
        <p className="px-4 pb-4 text-sm text-red-600">Не получилось сохранить. Попробуйте ещё раз.</p>
      )}
    </List>
  )
}
