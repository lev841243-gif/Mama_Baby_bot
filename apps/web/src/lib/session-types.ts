import type { ConsentType } from '@mama/shared/consent-types'
import type { ClientTextKey } from '@mama/shared/texts'

export type SessionPayload = {
  status: 'ready' | 'needConsent'
  beta: boolean
  consent: {
    items: { type: ConsentType; required: boolean; title: string; hint: string; docPath: string; inAcceptAll: boolean }[]
    granted: ConsentType[]
  }
  texts: Record<ClientTextKey, string>
}

export type ClosedPayload = { status: 'closed'; text: string }
