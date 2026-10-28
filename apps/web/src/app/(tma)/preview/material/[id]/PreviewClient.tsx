'use client'
import '@telegram-apps/telegram-ui/dist/styles.css'
import { AppRoot } from '@telegram-apps/telegram-ui'
import type { MaterialView } from '@/lib/material-view'
import { MaterialBody } from '../../../app/MaterialBody'

/** Материал теми же компонентами, что в приложении: автор видит то же, что мама (ТЗ 9.4). */
export function PreviewClient({ m, t }: { m: MaterialView; t: Record<string, string> }) {
  return (
    <AppRoot platform="base">
      <div className="mx-auto max-w-[420px]">
        <MaterialBody m={m} t={t} />
      </div>
    </AppRoot>
  )
}
