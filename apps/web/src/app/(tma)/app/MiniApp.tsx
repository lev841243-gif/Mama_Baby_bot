'use client'
import '@telegram-apps/telegram-ui/dist/styles.css'
import { DEFAULT_TEXTS } from '@mama/shared/texts'
import {
  init,
  isTMA,
  miniApp,
  retrieveLaunchParams,
  retrieveRawInitData,
  themeParams,
  useSignal,
  viewport,
} from '@telegram-apps/sdk-react'
import { AppRoot, Placeholder, Spinner } from '@telegram-apps/telegram-ui'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SessionPayload } from '@/lib/session-types'
import { ApiError, api } from './api'
import { BetaBanner } from './BetaBanner'
import { ConsentWindow } from './ConsentWindow'

type TgEnv = { ok: true; initData: string; platform: 'ios' | 'base' } | { ok: false }

/** Оформление и служебные вызовы не должны ронять приложение: без них оно всё равно работает. */
function optional(step: string, fn: () => void) {
  try {
    fn()
  } catch (err) {
    console.warn(`telegram sdk: ${step} failed`, err)
  }
}

function setupTelegram(): TgEnv {
  if (!isTMA()) return { ok: false }
  optional('init', () => init())
  optional('miniApp', () => {
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync()
      miniApp.bindCssVars()
    }
  })
  optional('themeParams', () => {
    if (themeParams.mountSync.isAvailable()) {
      themeParams.mountSync()
      themeParams.bindCssVars()
    }
  })
  optional('viewport', () => {
    if (viewport.mount.isAvailable()) {
      viewport
        .mount()
        .then(() => {
          viewport.bindCssVars()
          viewport.expand.ifAvailable()
        })
        .catch((err: unknown) => console.warn('telegram sdk: viewport failed', err))
    }
  })
  document.documentElement.dataset.tg = '1'
  optional('ready', () => miniApp.ready.ifAvailable())
  const initData = retrieveRawInitData()
  if (!initData) return { ok: false }
  const platform = retrieveLaunchParams().tgWebAppPlatform
  return { ok: true, initData, platform: platform === 'ios' || platform === 'macos' ? 'ios' : 'base' }
}

export default function MiniApp() {
  const [env] = useState(setupTelegram)
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }))

  if (!env.ok) {
    // Открытие по ссылке в обычном браузере (ТЗ 8.8).
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-lg">{DEFAULT_TEXTS.openViaBot}</p>
      </main>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemedRoot platform={env.platform}>
        <Screens initData={env.initData} />
      </ThemedRoot>
    </QueryClientProvider>
  )
}

function ThemedRoot({ platform, children }: { platform: 'ios' | 'base'; children: React.ReactNode }) {
  const isDark = useSignal(miniApp.isDark)
  return (
    <AppRoot appearance={isDark ? 'dark' : 'light'} platform={platform} className="min-h-dvh">
      {children}
    </AppRoot>
  )
}

function Screens({ initData }: { initData: string }) {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<SessionPayload>('/api/tma/session', initData),
    staleTime: Infinity,
  })

  if (session.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="l" />
      </div>
    )
  }

  if (session.error) {
    const closed = session.error instanceof ApiError && session.error.status === 403
    return (
      <Placeholder
        className="min-h-dvh"
        description={closed ? session.error.message : 'Не получилось загрузить. Закройте и откройте приложение ещё раз.'}
      />
    )
  }

  const data = session.data
  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {data.beta && <BetaBanner text={data.texts.betaBanner} />}
      {data.status === 'needConsent' ? (
        <ConsentWindow session={data} initData={initData} />
      ) : (
        <Home session={data} />
      )}
    </div>
  )
}

/** Заглушка главной: экраны материалов — шаг 5 плана. */
function Home({ session }: { session: SessionPayload }) {
  return (
    <Placeholder header="Дневник спокойного материнства" description="Скоро здесь появятся материалы по возрасту малыша.">
      <p className="text-sm opacity-60">{session.texts.medicalDisclaimer}</p>
    </Placeholder>
  )
}
