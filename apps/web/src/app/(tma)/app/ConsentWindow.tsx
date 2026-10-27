'use client'
import type { ConsentType } from '@mama/shared/consent-types'
import { hapticFeedback, openLink } from '@telegram-apps/sdk-react'
import { Button, Cell, Checkbox, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SessionPayload } from '@/lib/session-types'
import { api } from './api'

const linkStyle = { color: 'var(--tg-theme-link-color, #2481cc)' }

/** Вибрация — приятное дополнение; вне Telegram SDK бросает ошибку, её глотаем. */
function haptic(fn: () => void) {
  try {
    fn()
  } catch {
    /* нет Telegram — без вибрации */
  }
}

/**
 * Окно согласий (ТЗ 8.9). Галочки сняты по умолчанию; «Принять всё» — только показанные пункты;
 * «Продолжить с выбранными» — только с основным согласием; «Не сейчас» ничего не отправляет.
 */
export function ConsentWindow({ session, initData }: { session: SessionPayload; initData: string }) {
  const { items } = session.consent
  const t = session.texts
  const [checked, setChecked] = useState<Set<ConsentType>>(() => new Set())
  const [declined, setDeclined] = useState(false)
  const queryClient = useQueryClient()

  const submit = useMutation({
    mutationFn: (types: ConsentType[]) => api<SessionPayload>('/api/tma/consents', initData, { types }),
    onSuccess: (next) => {
      haptic(() => hapticFeedback.notificationOccurred.ifAvailable('success'))
      queryClient.setQueryData(['session'], next)
    },
  })

  const toggle = (type: ConsentType) => {
    haptic(() => hapticFeedback.selectionChanged.ifAvailable())
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

  return (
    <List>
      {session.beta && <p className="px-4 pt-3 text-[13px] opacity-70">{t.betaConsent}</p>}
      <div className="px-4 pt-2">
        <h1 className="text-xl font-semibold">{t.consentTitle}</h1>
        <p className="mt-2 text-[15px] leading-snug opacity-80">{t.consentIntro}</p>
      </div>
      <Section>
        {items.map((item) => (
          <Cell
            key={item.type}
            Component="label"
            multiline
            before={<Checkbox checked={checked.has(item.type)} onChange={() => toggle(item.type)} />}
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

      <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
        <Button size="l" stretched loading={submit.isPending} onClick={() => submit.mutate(items.map((i) => i.type))}>
          {t.consentAcceptAll}
        </Button>
        <Button
          size="l"
          stretched
          mode="bezeled"
          disabled={!checked.has('pd') || submit.isPending}
          onClick={() => submit.mutate([...checked])}
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
        {submit.isError && <p className="text-sm text-red-600">Не получилось сохранить. Попробуйте ещё раз.</p>}
      </div>
    </List>
  )
}
