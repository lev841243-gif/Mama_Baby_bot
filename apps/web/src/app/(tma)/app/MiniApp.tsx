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
import { AppRoot, Button, Placeholder, Spinner } from '@telegram-apps/telegram-ui'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { SessionPayload } from '@/lib/session-types'
import { ApiError, api } from './api'
import { BetaBanner } from './BetaBanner'
import { ConsentWindow } from './ConsentWindow'
import { AppCtx, type Nav, type Screen, initialStack, useApp } from './nav'
import { BookmarksScreen } from './screens/BookmarksScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { CalmScreen } from './screens/CalmScreen'
import { FeedScreen } from './screens/FeedScreen'
import { HomeScreen } from './screens/HomeScreen'
import { MatchScreen } from './screens/MatchScreen'
import { MaterialScreen } from './screens/MaterialScreen'
import { MusicScreen } from './screens/MusicScreen'
import { SearchScreen } from './screens/SearchScreen'
import { SectionScreen } from './screens/SectionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SubscriptionScreen } from './screens/SubscriptionScreen'
import { UsefulScreen } from './screens/UsefulScreen'
import { startParam, useBackButton } from './telegram'

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

const FONT_KEY = 'mama:font-large'

/** «Крупнее шрифт» (ТЗ 8.8) — удобство этого устройства, не данные мамы: только localStorage. */
function useFontLarge(): [boolean, (v: boolean) => void] {
  const [large, setLarge] = useState(() => {
    try {
      return localStorage.getItem(FONT_KEY) === '1'
    } catch {
      return false
    }
  })
  const set = (v: boolean) => {
    setLarge(v)
    try {
      if (v) localStorage.setItem(FONT_KEY, '1')
      else localStorage.removeItem(FONT_KEY)
    } catch {
      /* приватный режим — только на этот сеанс */
    }
  }
  return [large, set]
}

function Screens({ initData }: { initData: string }) {
  const [stack, setStack] = useState<Screen[]>(() => initialStack(startParam()))
  const [deleted, setDeleted] = useState(false)
  const [fontLarge, setFontLarge] = useFontLarge()
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<SessionPayload>('/api/tma/session', initData),
    staleTime: Infinity,
    enabled: !deleted,
  })

  const nav = useMemo<Nav>(
    () => ({
      push: (s) => {
        setStack((st) => [...st, s])
        window.scrollTo(0, 0)
      },
      back: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)),
      replace: (s) => {
        setStack((st) => [...st.slice(0, -1), s])
        window.scrollTo(0, 0)
      },
    }),
    [],
  )
  const screen = stack[stack.length - 1]!
  const canBack = stack.length > 1 && !deleted
  const hasTgBack = useBackButton(canBack ? nav.back : null)

  if (deleted && session.data) {
    const t = session.data.texts
    return (
      <Placeholder
        className="min-h-dvh"
        header={t.appDeletedTitle}
        description={t.appDeleted}
        action={
          <Button
            mode="bezeled"
            onClick={() => {
              // Вход с нуля, как у нового человека (ТЗ 6.5).
              queryClient.clear()
              setDeleted(false)
              setStack([{ name: 'home' }])
            }}
          >
            {t.backButton}
          </Button>
        }
      />
    )
  }

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
  const onDeleted = () => setDeleted(true)
  const needConsent = data.status === 'needConsent'

  return (
    <AppCtx.Provider value={{ nav, initData, session: data }}>
      <div className="pb-[calc(16px+env(safe-area-inset-bottom))]" style={fontLarge ? { zoom: 1.15 } : undefined}>
        {data.beta && <BetaBanner text={data.texts.betaBanner} />}
        {/* Без основного согласия — только окно согласий, куда бы ни вела ссылка (ТЗ 8, приёмка 1). */}
        {needConsent ? (
          <ConsentWindow key="first" mode="first" session={data} initData={initData} />
        ) : (
          <>
            {canBack && !hasTgBack && (
              <button type="button" className="px-4 pt-3 text-[15px]" style={{ color: 'var(--app-link)' }} onClick={nav.back}>
                {data.texts.backButton}
              </button>
            )}
            <ScreenView screen={screen} onDeleted={onDeleted} fontLarge={fontLarge} setFontLarge={setFontLarge} />
          </>
        )}
      </div>
    </AppCtx.Provider>
  )
}

function ScreenView({
  screen,
  onDeleted,
  fontLarge,
  setFontLarge,
}: {
  screen: Screen
  onDeleted: () => void
  fontLarge: boolean
  setFontLarge: (v: boolean) => void
}) {
  const { initData, session } = useApp()
  switch (screen.name) {
    case 'home':
      return <HomeScreen />
    case 'section':
      return <SectionScreen key={screen.id} id={screen.id} />
    case 'material':
      return <MaterialScreen key={screen.id} id={screen.id} section={screen.section} />
    case 'bookmarks':
      return <BookmarksScreen />
    case 'calm':
      return <CalmScreen />
    case 'match':
      return <MatchScreen />
    case 'music':
      return <MusicScreen />
    case 'useful':
      return <UsefulScreen />
    case 'search':
      return <SearchScreen />
    case 'subscription':
      return <SubscriptionScreen />
    case 'settings':
      return <SettingsScreen onDeleted={onDeleted} fontLarge={fontLarge} setFontLarge={setFontLarge} />
    case 'calendar':
      return <CalendarScreen />
    case 'feed':
      return <FeedScreen />
    case 'consents':
      return <ConsentWindow key="manage" mode="manage" session={session} initData={initData} onDeleted={onDeleted} />
  }
}
