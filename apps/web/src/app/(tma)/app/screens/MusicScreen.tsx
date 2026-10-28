'use client'
import { openLink } from '@telegram-apps/sdk-react'
import { Button, Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useQuery } from '@tanstack/react-query'
import type { MusicPayload } from '@/lib/tma-types'
import { api } from '../api'
import { useApp } from '../nav'
import { Loading, Message } from '../ui'

/** Внешняя ссылка: в Telegram — через openLink (откроется приложение или браузер), иначе новая вкладка. */
export function openExternal(url: string) {
  try {
    if (openLink.isAvailable()) {
      openLink(url)
      return
    }
  } catch {
    /* вне Telegram */
  }
  window.open(url, '_blank', 'noopener')
}

/**
 * «Потешки и музыка» (ТЗ 8.5): плейлисты автора в Яндекс Музыке. Файлы музыки проект не хранит.
 * TODO(Р24): виджет показывается, только если включён в настройках после проверки на телефонах.
 */
export function MusicScreen() {
  const { initData, session } = useApp()
  const t = session.texts
  const q = useQuery({ queryKey: ['music'], queryFn: () => api<MusicPayload>('/api/tma/music', initData) })
  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  return (
    <List>
      <h1 className="px-4 pt-3 text-[22px] font-semibold">{t.musicTitle}</h1>
      <p className="px-4 text-[14px] opacity-70">{t.musicNote}</p>
      {q.data.playlists.length === 0 && <Message text={t.musicEmpty} />}
      {q.data.playlists.map((p) => (
        <Section key={p.id}>
          <Cell multiline subtitle={p.description || undefined}>
            {p.title}
          </Cell>
          {p.embedUrl && (
            <iframe
              title={p.title}
              src={p.embedUrl}
              className="block h-[450px] w-full border-0"
              allow="autoplay; encrypted-media"
              loading="lazy"
            />
          )}
          <div className="px-4 pb-3">
            <Button size="m" mode="bezeled" stretched onClick={() => openExternal(p.url)}>
              {t.musicOpen}
            </Button>
          </div>
        </Section>
      ))}
    </List>
  )
}
