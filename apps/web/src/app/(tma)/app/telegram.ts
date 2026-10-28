'use client'
import { backButton, hapticFeedback, mainButton, retrieveLaunchParams, swipeBehavior } from '@telegram-apps/sdk-react'
import { useEffect, useState } from 'react'

/** Вибрация — приятное дополнение; вне Telegram SDK бросает ошибку, её глотаем. */
export function haptic(fn: (h: typeof hapticFeedback) => void) {
  try {
    fn(hapticFeedback)
  } catch {
    /* нет Telegram — без вибрации */
  }
}

/** Системная кнопка «Назад» Telegram на вложенных экранах. Возвращает false, если её нет. */
export function useBackButton(onBack: (() => void) | null): boolean {
  let supported = false
  try {
    supported = backButton.isSupported()
  } catch {
    supported = false
  }

  useEffect(() => {
    if (!supported) return
    try {
      if (!backButton.isMounted()) backButton.mount()
      if (!onBack) {
        backButton.hide()
        return
      }
      backButton.show()
      return backButton.onClick(onBack)
    } catch {
      return
    }
  }, [onBack, supported])

  return supported
}

/**
 * Главная кнопка Telegram внизу экрана. Возвращает false, если её нет (старый клиент) —
 * тогда экран рисует свою кнопку.
 */
export function useMainButton(text: string | null, onClick: () => void): boolean {
  const [supported] = useState(() => {
    try {
      if (!mainButton.mount.isAvailable()) return false
      if (!mainButton.isMounted()) mainButton.mount()
      return true
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!supported) return
    try {
      if (!text) {
        mainButton.setParams({ isVisible: false })
        return
      }
      mainButton.setParams({ text, isVisible: true, isEnabled: true })
      const off = mainButton.onClick(onClick)
      return () => {
        off()
        mainButton.setParams({ isVisible: false })
      }
    } catch {
      return
    }
  }, [supported, text, onClick])

  return supported
}

/** На экране упражнения вертикальный свайп не должен закрывать приложение (CLAUDE.md, мобильные требования). */
export function useNoVerticalSwipes() {
  useEffect(() => {
    try {
      if (!swipeBehavior.mount.isAvailable()) return
      if (!swipeBehavior.isMounted()) swipeBehavior.mount()
      swipeBehavior.disableVertical.ifAvailable()
      return () => {
        swipeBehavior.enableVertical.ifAvailable()
      }
    } catch {
      return
    }
  }, [])
}

/** Параметр прямой ссылки t.me/<бот>/<app>?startapp=… (ТЗ 8.8). */
export function startParam(): string | null {
  try {
    return retrieveLaunchParams().tgWebAppStartParam ?? null
  } catch {
    return null
  }
}
