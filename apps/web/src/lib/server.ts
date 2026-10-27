import 'server-only'
import {
  DEFAULT_TEXTS,
  QUEUE_BOT,
  checkAccess,
  createLogger,
  createRedis,
  fmt,
  getConsentState,
  getSettings,
  hashTgId,
  visibleConsentItems,
  type ConsentState,
} from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { Queue } from 'bullmq'
import { NextResponse } from 'next/server'
import { TmaAuthError, authenticateTma } from './tma-auth'
import type { SessionPayload } from './session-types'

export const log = createLogger('web')

let botQueue: Queue | undefined
export function getBotQueue() {
  botQueue ??= new Queue(QUEUE_BOT, { connection: createRedis() })
  return botQueue
}

const channelUrl = () => process.env.CHANNEL_URL ?? 'https://t.me/detimam_pro'

/** Тексты для мини-приложения. TODO(шаг 3): из Payload global, правит автор (ТЗ 6.8). */
function clientTexts() {
  const t = DEFAULT_TEXTS
  return {
    betaBanner: t.betaBanner,
    betaConsent: t.betaConsent,
    consentTitle: t.consentTitle,
    consentIntro: t.consentIntro,
    consentAcceptAll: t.consentAcceptAll,
    consentContinue: t.consentContinue,
    consentNotNow: t.consentNotNow,
    consentNotNowText: t.consentNotNowText,
    consentDocLink: t.consentDocLink,
    privacyLink: t.privacyLink,
    medicalDisclaimer: t.medicalDisclaimer,
  }
}

export async function buildSession(state: ConsentState): Promise<SessionPayload> {
  const settings = await getSettings(getDb())
  return {
    status: state.pdValid ? 'ready' : 'needConsent',
    beta: settings.betaBanner,
    consent: {
      items: visibleConsentItems().map(({ type, required, title, hint, docPath }) => ({
        type,
        required,
        title,
        hint,
        docPath,
      })),
      granted: Object.keys(state.granted) as SessionPayload['consent']['granted'],
    },
    texts: clientTexts(),
  }
}

type Handler = (ctx: { tgId: number; isTester: boolean; req: Request }) => Promise<Response>

/**
 * Общая обёртка API мини-приложения: подпись initData → закрытый режим.
 * Тем, кого нет в списке доступа, отвечаем 403 и ничего о них не пишем (ТЗ 14).
 */
export function tmaRoute(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    let tgId: number
    try {
      ;({ tgId } = authenticateTma(req))
    } catch (e) {
      if (e instanceof TmaAuthError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      throw e
    }
    try {
      const access = await checkAccess(getDb(), tgId)
      if (!access.allowed) {
        return NextResponse.json(
          { status: 'closed', text: fmt(DEFAULT_TEXTS.notInAccessList, { channelUrl: channelUrl() }) },
          { status: 403 },
        )
      }
      return await handler({ tgId, isTester: access.closedMode, req })
    } catch (e) {
      log.error({ err: e, user: hashTgId(tgId) }, 'tma api error')
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
  }
}

export { getConsentState, getDb }
