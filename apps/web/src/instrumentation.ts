// Ошибки сервера → GlitchTip (совместим с Sentry SDK), если задан SENTRY_DSN (ТЗ 13, CLAUDE.md).
// Без персональных данных: ни пользователя, ни заголовков, ни тела запроса (initData, тексты мам).
import type { Instrumentation } from 'next'

export async function register() {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== 'nodejs') return
  const Sentry = await import('@sentry/nextjs')
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.DOMAIN ?? 'local',
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, queues: false },
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user
      if (event.request) event.request = { method: event.request.method, url: event.request.url?.split('?')[0] }
      event.breadcrumbs = []
      return event
    },
  })
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
