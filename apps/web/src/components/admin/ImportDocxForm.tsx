'use client'
import { Button } from '@payloadcms/ui'
import { useState } from 'react'

export function ImportDocxForm() {
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false })

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState({ busy: true })
    const res = await fetch('/api/materials/import-docx', { method: 'POST', body: new FormData(e.currentTarget), credentials: 'include' })
    const json = (await res.json().catch(() => ({}))) as { id?: number; error?: string }
    if (res.ok && json.id) {
      window.location.href = `/admin/collections/materials/${json.id}`
      return
    }
    setState({ busy: false, error: json.error ?? 'Не получилось загрузить' })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <input type="file" name="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
      <Button type="submit" disabled={state.busy} margin={false}>
        {state.busy ? 'Загружаю…' : 'Загрузить и создать черновик'}
      </Button>
      {state.error && <p style={{ color: 'var(--theme-error-500)', margin: 0 }}>{state.error}</p>}
    </form>
  )
}
