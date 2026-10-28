'use client'
import type { AgeSectionId } from '@mama/shared/age'
import { Button } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeedbackPayload, MaterialPayload } from '@/lib/tma-types'
import { api } from '../api'
import { MaterialBody } from '../MaterialBody'
import { useApp } from '../nav'
import { useNoVerticalSwipes } from '../telegram'
import { CardCell, Disclaimer, Loading, Message } from '../ui'

export function MaterialScreen({ id, section }: { id: number; section?: AgeSectionId }) {
  const { nav, initData, session } = useApp()
  const t = session.texts
  const qc = useQueryClient()
  const key = ['material', id]
  const q = useQuery({ queryKey: key, queryFn: () => api<MaterialPayload>('/api/tma/material', initData, { id }) })
  useNoVerticalSwipes()

  const bookmark = useMutation({
    mutationFn: (on: boolean) => api('/api/tma/bookmark', initData, { id, on }),
    onMutate: (on) => qc.setQueryData<MaterialPayload>(key, (d) => (d ? { ...d, bookmarked: on } : d)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })

  if (q.isPending) return <Loading />
  if (q.error) return <Message text={t.loadError} />
  const d = q.data

  if (d.status !== 'ok' && d.status !== 'locked') {
    return (
      <Message
        text={d.status === 'archived' ? t.unavailable : t.notFound}
        action={
          d.bookmarked ? (
            <Button mode="bezeled" onClick={() => bookmark.mutate(false)}>
              {t.bookmarkRemove}
            </Button>
          ) : undefined
        }
      />
    )
  }

  if (d.status === 'locked') {
    // Закрытый материал без подписки: только карточка и анонс (ТЗ 8.6). Экран «Подписка» — шаг 8.
    return (
      <div>
        <CardCell card={d.card} t={t} onClick={() => undefined} />
        <Message text={`${t.lockedTitle}. ${t.lockedText}`} />
        {d.card.announce && <p className="whitespace-pre-line px-4">{d.card.announce}</p>}
        <Disclaimer text={t.medicalDisclaimer} />
      </div>
    )
  }

  return (
    <MaterialBody
      m={d.material}
      t={t}
      done={d.done}
      actions={{
        bookmarked: d.bookmarked,
        onBookmark: (on) => bookmark.mutate(on),
        onFeedback: async (result) => {
          const r = await api<FeedbackPayload>('/api/tma/feedback', initData, { id, result, section })
          void qc.invalidateQueries({ queryKey: ['home'] })
          void qc.invalidateQueries({ queryKey: ['section'] })
          return r.next
        },
        onOpen: (next) => nav.replace({ name: 'material', id: next, section }),
      }}
    />
  )
}
