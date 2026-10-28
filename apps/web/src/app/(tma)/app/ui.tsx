'use client'
import { fmt } from '@mama/shared/texts'
import { Cell, Placeholder, Spinner } from '@telegram-apps/telegram-ui'
import type { ClientImage } from '@/lib/media-url'
import type { Card } from '@/lib/tma-types'

/** Картинка по подписанной ссылке: webp-размеры из srcset; MP4 вместо GIF — беззвучное видео по кругу. */
export function Img({ img, className, sizes = '100vw', eager }: { img: ClientImage | null; className?: string; sizes?: string; eager?: boolean }) {
  if (!img) return null
  if (img.video) return <video src={img.src} autoPlay muted loop playsInline className={className} aria-label={img.alt} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.src}
      srcSet={img.srcSet}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt ?? ''}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  )
}

export function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Spinner size="l" />
    </div>
  )
}

export function Message({ text, action }: { text: string; action?: React.ReactNode }) {
  return <Placeholder description={text} action={action} />
}

export function Disclaimer({ text }: { text: string }) {
  return <p className="px-4 py-4 text-center text-[13px] opacity-60">{text}</p>
}

type T = Record<string, string>

export function cardSubtitle(c: Card, t: T): string {
  return [c.tags[0], c.minutes ? fmt(t.minutesShort ?? '{n} мин', { n: String(c.minutes) }) : null, c.done ? t.doneBadge : null]
    .filter(Boolean)
    .join(' · ')
}

/** Карточка материала (ТЗ 8.1): картинка, название, тег, время, замок у закрытого. */
export function CardCell({ card, t, onClick }: { card: Card; t: T; onClick: () => void }) {
  return (
    <Cell
      onClick={onClick}
      before={
        card.cover ? (
          <Img img={card.cover} sizes="64px" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-xl" style={{ background: 'var(--app-secondary-bg)' }} />
        )
      }
      after={card.access === 'paid' ? <span aria-label={t.lockedTitle}>🔒</span> : undefined}
      subtitle={cardSubtitle(card, t)}
      multiline
    >
      {card.title}
    </Cell>
  )
}
