import type { Texts } from '@mama/shared'
import type { ClientImage } from '@/lib/media-url'
import type { MaterialView } from '@/lib/material-view'

function Img({ img, className }: { img: ClientImage | null; className?: string }) {
  if (!img) return null
  if (img.video) return <video src={img.src} autoPlay muted loop playsInline className={className} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img.src} srcSet={img.srcSet} sizes="(max-width: 420px) 100vw, 420px" alt={img.alt ?? ''} className={className} />
}

/** Предпросмотр: анонс в боте и материал в ширине телефона. */
export function MaterialPreview({ material: m, texts, status }: { material: MaterialView; texts: Texts; status: string }) {
  return (
    <main className="mx-auto flex max-w-[420px] flex-col gap-6 p-4">
      <p className="text-sm opacity-60">
        Предпросмотр · {status === 'published' ? 'опубликовано' : 'черновик'} · {m.access === 'paid' ? 'по подписке' : 'бесплатно'}
      </p>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase opacity-60">Анонс в боте</h2>
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--app-secondary-bg)' }}>
          <Img img={m.cover} className="w-full" />
          <div className="p-3">
            <p className="font-semibold">{m.title}</p>
            <p className="mt-1 whitespace-pre-line text-[15px]">{m.announce || <i className="opacity-60">Анонс не заполнен</i>}</p>
          </div>
          <div className="border-t p-2 text-center text-[15px]" style={{ color: 'var(--app-link)', borderColor: 'var(--app-bg)' }}>
            {texts.openAppButton}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase opacity-60">В приложении</h2>
        {m.type !== 'exercise' && <Img img={m.cover} className="w-full rounded-2xl" />}
        <h1 className="text-2xl font-semibold leading-tight">{m.title}</h1>
        <p className="text-sm opacity-60">
          {[m.tags.join(', '), m.minutes ? `${m.minutes} мин` : null, m.ageFrom !== null ? `${m.ageFrom}–${m.ageTo} мес.` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {m.steps.map((s, i) => (
          <div key={i} className="overflow-hidden rounded-2xl" style={{ background: 'var(--app-secondary-bg)' }}>
            <Img img={s.image} className="aspect-square w-full object-cover" />
            <p className="p-3 text-[17px]">
              <b>Шаг {i + 1}.</b> {s.text}
            </p>
          </div>
        ))}
        {m.bodyHtml && <div className="doc !p-0" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />}
        {m.audio && <audio controls src={m.audio.src} className="w-full" />}
        {m.howToKnow && <Block title="Как понять, что получается" text={m.howToKnow} />}
        {m.type === 'exercise' && <Block title="Пока не получается" text={m.ifNotWorking || '(общий текст из «Текстов»)'} />}
        {m.easierVariant && <Block title="Облегчённый вариант" text={m.easierVariant} />}
        {m.whenToSeeDoctor && <Block title="Когда показать врачу" text={m.whenToSeeDoctor} />}
        <p className="text-center text-sm opacity-60">{texts.medicalDisclaimer}</p>
      </section>
    </main>
  )
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--app-secondary-bg)' }}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 whitespace-pre-line">{text}</p>
    </div>
  )
}
