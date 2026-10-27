import type { ConsentType } from '@mama/shared/consent-types'

export type SessionPayload = {
  status: 'ready' | 'needConsent'
  beta: boolean
  consent: {
    items: { type: ConsentType; required: boolean; title: string; hint: string; docPath: string }[]
    granted: ConsentType[]
  }
  texts: Record<
    | 'betaBanner'
    | 'betaConsent'
    | 'consentTitle'
    | 'consentIntro'
    | 'consentAcceptAll'
    | 'consentContinue'
    | 'consentNotNow'
    | 'consentNotNowText'
    | 'consentDocLink'
    | 'privacyLink'
    | 'medicalDisclaimer',
    string
  >
}

export type ClosedPayload = { status: 'closed'; text: string }
