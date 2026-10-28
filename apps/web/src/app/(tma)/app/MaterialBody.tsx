'use client'
import { fmt } from '@mama/shared/texts'
import { Button } from '@telegram-apps/telegram-ui'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import type { MaterialView } from '@/lib/material-view'
import type { Card } from '@/lib/tma-types'
import { haptic, useMainButton } from './telegram'
import { CardCell, Disclaimer, Img } from './ui'

type T = Record<string, string>

export type MaterialActions = {
  bookmarked: boolean
  onBookmark: (on: boolean) => void
  onFeedback: (result: 'done' | 'hard') => Promise<Card | null>
  onOpen: (id: number) => void
}

/** Материал как его видит мама. Тот же компонент — в предпросмотре автора (без actions). */
export function MaterialBody({ m, t, actions, done }: { m: MaterialView; t: T; actions?: MaterialActions; done?: boolean }) {
  return (
    <article className="pb-4">
      {m.type === 'exercise' ? <ExerciseView m={m} t={t} actions={actions} done={done} /> : <ArticleView m={m} t={t} />}
      {actions && (
        <div className="px-4 pt-2">
          <Button mode={actions.bookmarked ? 'plain' : 'bezeled'} size="m" stretched onClick={() => actions.onBookmark(!actions.bookmarked)}>
            {actions.bookmarked ? t.bookmarkRemove : t.bookmarkAdd}
          </Button>
        </div>
      )}
      {m.seeAlso.length > 0 && (
        <section className="pt-4">
          <h2 className="px-4 pb-1 text-[13px] font-semibold uppercase opacity-60">{t.seeAlso}</h2>
          {m.seeAlso.map((c) => (
            <CardCell key={c.id} card={c} t={t} onClick={() => actions?.onOpen(c.id)} />
          ))}
        </section>
      )}
      <Disclaimer text={t.medicalDisclaimer} />
    </article>
  )
}

function Meta({ m, t }: { m: MaterialView; t: T }) {
  const line = [m.tags.join(', '), m.minutes ? fmt(t.minutesShort, { n: String(m.minutes) }) : null].filter(Boolean).join(' · ')
  return line ? <p className="px-4 text-[14px] opacity-60">{line}</p> : null
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-4 mt-3 rounded-2xl p-4" style={{ background: 'var(--app-secondary-bg)' }}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 whitespace-pre-line">{text}</p>
    </div>
  )
}

function AudioBlock({ m }: { m: MaterialView }) {
  // Полноценный плеер со скоростью и «Прислать в чат» — шаг 6.
  if (!m.audio) return null
  return <audio controls preload="none" src={m.audio.src} className="mx-4 mt-3 w-[calc(100%-2rem)]" />
}

function ArticleView({ m, t }: { m: MaterialView; t: T }) {
  return (
    <>
      {m.cover && <Img img={m.cover} eager className="aspect-[4/3] w-full object-cover" />}
      <h1 className="px-4 pt-3 text-[24px] font-semibold leading-tight">{m.title}</h1>
      <Meta m={m} t={t} />
      <AudioBlock m={m} />
      <div className="material-body px-4" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
    </>
  )
}

/** Упражнение по шагам (ТЗ 8.2): слайды свайпом, после последнего — «Как понять» и две кнопки. */
function ExerciseView({ m, t, actions, done }: { m: MaterialView; t: T; actions?: MaterialActions; done?: boolean }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, containScroll: 'trimSnaps' })
  const [index, setIndex] = useState(0)
  const total = m.steps.length
  const onFinal = index >= total

  useEffect(() => {
    if (!embla) return
    const onSelect = () => setIndex(embla.selectedScrollSnap())
    embla.on('select', onSelect)
    return () => {
      embla.off('select', onSelect)
    }
  }, [embla])

  const next = useCallback(() => {
    embla?.scrollNext()
    haptic((h) => h.selectionChanged())
  }, [embla])
  const hasMainButton = useMainButton(actions && !onFinal ? t.stepNext : null, next)

  return (
    <>
      <h1 className="px-4 pt-3 text-[22px] font-semibold leading-tight">{m.title}</h1>
      <Meta m={m} t={t} />
      <AudioBlock m={m} />
      <div className="mt-3 overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {m.steps.map((s, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%] px-4">
              <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--app-secondary-bg)' }}>
                <Img img={s.image} eager={i === 0} sizes="(max-width: 480px) 100vw, 480px" className="aspect-square w-full object-contain" />
              </div>
              <p className="pt-3 text-[13px] opacity-60">{fmt(t.stepOf, { n: String(i + 1), total: String(total) })}</p>
              <p className="pt-1 text-[18px] leading-snug">{s.text}</p>
            </div>
          ))}
          <div className="min-w-0 flex-[0_0_100%]">
            <FinalSlide m={m} t={t} actions={actions} done={done} />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pt-3" aria-hidden>
        {[...m.steps, null].map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--app-text)', opacity: i === index ? 0.8 : 0.2 }} />
        ))}
      </div>
      {!onFinal && (!actions || !hasMainButton) && (
        <div className="px-4 pt-3">
          <Button size="l" stretched onClick={next}>
            {t.stepNext}
          </Button>
        </div>
      )}
    </>
  )
}

function FinalSlide({ m, t, actions, done }: { m: MaterialView; t: T; actions?: MaterialActions; done?: boolean }) {
  const [result, setResult] = useState<{ kind: 'done'; next: Card | null } | { kind: 'hard' } | null>(null)
  const [busy, setBusy] = useState(false)

  const feedback = async (kind: 'done' | 'hard') => {
    if (!actions) {
      setResult(kind === 'done' ? { kind, next: null } : { kind })
      return
    }
    setBusy(true)
    try {
      const next = await actions.onFeedback(kind)
      haptic((h) => h.notificationOccurred(kind === 'done' ? 'success' : 'warning'))
      setResult(kind === 'done' ? { kind, next } : { kind })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-2">
      {m.howToKnow && <Block title={t.howToKnowTitle} text={m.howToKnow} />}
      {result?.kind !== 'done' && (
        <div className="flex flex-col gap-2 px-4 pt-3">
          <Button size="l" stretched loading={busy} onClick={() => feedback('done')}>
            {t.doneButton}
            {done ? ' ✓' : ''}
          </Button>
          {!result && (
            <Button size="l" mode="bezeled" stretched disabled={busy} onClick={() => feedback('hard')}>
              {t.notYetButton}
            </Button>
          )}
        </div>
      )}
      {result?.kind === 'done' && (
        <div className="pt-3">
          <p className="px-4">{result.next ? t.doneNext : t.doneLast}</p>
          {result.next && <CardCell card={result.next} t={t} onClick={() => actions?.onOpen(result.next!.id)} />}
        </div>
      )}
      {result?.kind === 'hard' && (
        <>
          <Block title={t.notYetButton} text={m.ifNotWorking || t.notYetDefault} />
          {m.easierVariant && <Block title={t.easierTitle} text={m.easierVariant} />}
        </>
      )}
      {m.whenToSeeDoctor && <Block title={t.doctorTitle} text={m.whenToSeeDoctor} />}
    </div>
  )
}
