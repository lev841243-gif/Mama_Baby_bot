'use client'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

/** Боковая панель материала: предпросмотр как в приложении и тестовая отправка анонса себе (ТЗ 9.4). */
export function MaterialTools() {
  const { id } = useDocumentInfo()
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false })

  if (!id) return <p style={{ opacity: 0.7 }}>Сохраните черновик — появятся предпросмотр и тестовая отправка.</p>

  const send = async () => {
    setState({ busy: true })
    const res = await fetch(`/api/materials/${id}/test-announce`, { method: 'POST', credentials: 'include' })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setState({ busy: false, message: res.ok ? 'Отправлено — проверьте чат с ботом.' : (json.error ?? 'Не получилось отправить') })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
      <Button el="anchor" url={`/preview/material/${id}`} newTab buttonStyle="secondary" margin={false}>
        Предпросмотр в приложении
      </Button>
      <Button onClick={send} disabled={state.busy} buttonStyle="secondary" margin={false}>
        {state.busy ? 'Отправляю…' : 'Отправить анонс себе в бот'}
      </Button>
      {state.message && <p style={{ margin: 0 }}>{state.message}</p>}
      <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
        Отправляется последняя сохранённая версия. Telegram ID — в вашем профиле админки.
      </p>
    </div>
  )
}
