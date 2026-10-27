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
import { AppRoot, Button, Cell, List, Placeholder, Section, Spinner } from '@telegram-apps/telegram-ui'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { SessionPayload } from '@/lib/session-types'
import { ApiError, api } from './api'
import { BetaBanner } from './BetaBanner'
import { Confirm } from './Confirm'
import { ConsentWindow } from './ConsentWindow'
import { useBackButton } from './telegram'

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

type Screen = 'home' | 'settings' | 'consents'

/** Экран из ссылки бота: /app?screen=consents — «Мои согласия» из настроек бота. */
function initialScreen(): Screen {
  const s = new URLSearchParams(window.location.search).get('screen')
  return s === 'consents' || s === 'settings' ? s : 'home'
}

function Screens({ initData }: { initData: string }) {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [deleted, setDeleted] = useState(false)
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<SessionPayload>('/api/tma/session', initData),
    staleTime: Infinity,
    enabled: !deleted,
  })

  const back = useCallback(() => setScreen((s) => (s === 'consents' ? 'settings' : 'home')), [])
  const hasTgBack = useBackButton(screen !== 'home' && !deleted ? back : null)

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
              setDeleted(false)
              setScreen('home')
              void queryClient.invalidateQueries({ queryKey: ['session'] })
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
  // Без основного согласия — только окно согласий, куда бы ни вела ссылка (ТЗ 8, приёмка 1).
  const current: Screen | 'consent' = data.status === 'needConsent' ? 'consent' : screen

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {data.beta && <BetaBanner text={data.texts.betaBanner} />}
      {current !== 'home' && current !== 'consent' && !hasTgBack && (
        <button type="button" className="px-4 pt-3 text-[15px]" style={{ color: 'var(--tg-theme-link-color, #2481cc)' }} onClick={back}>
          {data.texts.backButton}
        </button>
      )}
      {current === 'consent' && <ConsentWindow key="first" mode="first" session={data} initData={initData} />}
      {current === 'home' && <Home session={data} onSettings={() => setScreen('settings')} />}
      {current === 'settings' && (
        <Settings session={data} initData={initData} onConsents={() => setScreen('consents')} onDeleted={onDeleted} />
      )}
      {current === 'consents' && (
        <ConsentWindow key="manage" mode="manage" session={data} initData={initData} onDeleted={onDeleted} />
      )}
    </div>
  )
}

/** Заглушка главной: экраны материалов — шаг 5 плана. */
function Home({ session, onSettings }: { session: SessionPayload; onSettings: () => void }) {
  return (
    <>
      <Placeholder
        header="Дневник спокойного материнства"
        description="Скоро здесь появятся материалы по возрасту малыша."
        action={
          <Button mode="bezeled" onClick={onSettings}>
            {session.texts.settingsButton}
          </Button>
        }
      />
      <p className="px-4 text-center text-sm opacity-60">{session.texts.medicalDisclaimer}</p>
    </>
  )
}

/** Настройки (ТЗ 8.1, п. 12). Возраст, лента и закладки — следующие шаги. */
function Settings({
  session,
  initData,
  onConsents,
  onDeleted,
}: {
  session: SessionPayload
  initData: string
  onConsents: () => void
  onDeleted: () => void
}) {
  const t = session.texts
  const [confirming, setConfirming] = useState(false)
  const revokeAll = useMutation({
    mutationFn: () => api<{ status: 'deleted' }>('/api/tma/revoke', initData),
    onSuccess: onDeleted,
  })

  return (
    <List>
      <h1 className="px-4 pt-2 text-xl font-semibold">{t.appSettingsTitle}</h1>
      <Section>
        <Cell onClick={onConsents}>{t.myConsentsButton}</Cell>
        <Cell onClick={() => setConfirming(true)} style={{ color: 'var(--tg-theme-destructive-text-color, #e53935)' }}>
          {t.appRevokeAll}
        </Cell>
      </Section>
      {confirming && (
        <Confirm
          text={t.revokeConfirm}
          okText={t.revokeYes}
          cancelText={t.revokeNo}
          loading={revokeAll.isPending}
          onOk={() => revokeAll.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
      {revokeAll.isError && <p className="px-4 text-sm text-red-600">Не получилось удалить. Попробуйте ещё раз.</p>}
    </List>
  )
}
