import 'server-only'
import {
  CLIENT_TEXT_KEYS,
  QUEUE_BOT,
  alert,
  checkAccess,
  createLogger,
  createRedis,
  fmt,
  getConsentState,
  getConfig,
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

/** Тексты для мини-приложения — из админки (ТЗ 6.8). */
function clientTexts(texts: Awaited<ReturnType<typeof getConfig>>['texts']) {
  return Object.fromEntries(CLIENT_TEXT_KEYS.map((k) => [k, texts[k]])) as SessionPayload['texts']
}

export async function buildSession(state: ConsentState): Promise<SessionPayload> {
  const { settings, texts } = await getConfig(getDb())
  return {
    status: state.pdValid ? 'ready' : 'needConsent',
    beta: settings.betaBanner,
    consent: {
      items: visibleConsentItems(settings).map(({ type, required, title, hint, docPath, inAcceptAll }) => ({
        type,
        required,
        title,
        hint,
        docPath,
        inAcceptAll,
      })),
      granted: Object.keys(state.granted) as SessionPayload['consent']['granted'],
    },
    texts: clientTexts(texts),
  }
}

type Handler = (ctx: { tgId: number; isTester: boolean; req: Request }) => Promise<Response>

type RouteOptions = {
  /**
   * Требовать действующее основное согласие (по умолчанию да). Без него приложение не отдаёт
   * ничего, кроме окна согласий (ТЗ 8, приёмка 1). Выключается только для входа, согласий и отзыва.
   */
  requireConsent?: boolean
}

/**
 * Общая обёртка API мини-приложения: подпись initData → закрытый режим → основное согласие.
 * Тем, кого нет в списке доступа, отвечаем 403 и ничего о них не пишем (ТЗ 14).
 */
export function tmaRoute(handler: Handler, { requireConsent = true }: RouteOptions = {}) {
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
        const { texts } = await getConfig(getDb())
        return NextResponse.json(
          { status: 'closed', text: fmt(texts.notInAccessList, { channelUrl: channelUrl() }) },
          { status: 403 },
        )
      }
      // Все, кто вошёл во время тестирования, помечаются тестировщиками — их данные удалятся перед бета-тестом (ТЗ 14).
      const { testerPhase } = await getSettings(getDb())
      if (requireConsent && !(await getConsentState(getDb(), tgId)).pdValid) {
        return NextResponse.json({ status: 'needConsent' }, { status: 403 })
      }
      return await handler({ tgId, isTester: testerPhase, req })
    } catch (e) {
      log.error({ err: e, user: hashTgId(tgId) }, 'tma api error')
      void alert(`tma:${new URL(req.url).pathname}`, `Ошибка API приложения: ${new URL(req.url).pathname}`)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
  }
}

export { getConsentState, getDb }
