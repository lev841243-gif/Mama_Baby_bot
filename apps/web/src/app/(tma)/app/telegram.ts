'use client'
import { backButton, hapticFeedback } from '@telegram-apps/sdk-react'
import { useEffect } from 'react'

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
