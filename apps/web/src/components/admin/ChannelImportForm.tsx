'use client'
import { Button } from '@payloadcms/ui'
import { useState } from 'react'

type Stats = { total: number; created: number; skipped: number; posts: number; carousels: number }

export function ChannelImportForm({ freeBlocks }: { freeBlocks: number }) {
  const [busy, setBusy] = useState<'import' | 'group' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const upload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy('import')
    setMessage(null)
    const res = await fetch('/api/channel-posts/import', { method: 'POST', body: new FormData(e.currentTarget), credentials: 'include' })
    const json = (await res.json().catch(() => ({}))) as Stats & { error?: string }
    setBusy(null)
    setMessage(
      res.ok
        ? `Готово: постов в выгрузке ${json.total}, новых ${json.created}; материалов ${json.posts} (каруселей ${json.carousels}), пропущено ${json.skipped}. Обновите страницу.`
        : (json.error ?? 'Не получилось загрузить'),
    )
  }

  const group = async () => {
    setBusy('group')
    const res = await fetch('/api/channel-posts/group', { method: 'POST', credentials: 'include' })
    setBusy(null)
    setMessage(res.ok ? 'Задача поставлена. Черновики появятся в «Материалах» через минуту-другую.' : 'Не получилось запустить сборку')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <form onSubmit={upload} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" name="file" accept=".zip,.json,application/zip,application/json" required />
        <Button type="submit" disabled={busy !== null} margin={false}>
          {busy === 'import' ? 'Загружаю… (может занять минуты)' : 'Загрузить выгрузку'}
        </Button>
      </form>
      <Button onClick={group} disabled={busy !== null || freeBlocks === 0} buttonStyle="secondary" margin={false}>
        {busy === 'group' ? 'Запускаю…' : `Предложить статьи (несобранных блоков: ${freeBlocks})`}
      </Button>
      {message && <p style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
