import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { type ClientImage, type MediaDoc, clientImage, signedMediaPath } from './media-url'

// Материал из Payload → то, что видит мама (мини-приложение, предпросмотр). Только тексты автора.

export type StepView = { image: ClientImage | null; text: string }
export type AudioView = { src: string; mimeType: string; mediaId: number }

export type MaterialView = {
  id: number
  type: 'exercise' | 'article' | 'body' | 'psy'
  title: string
  access: 'free' | 'paid'
  cover: ClientImage | null
  tags: string[]
  minutes: number | null
  ageFrom: number | null
  ageTo: number | null
  announce: string
  steps: StepView[]
  bodyHtml: string
  howToKnow: string
  ifNotWorking: string
  easierVariant: string
  whenToSeeDoctor: string
  audio: AudioView | null
  /** Только опубликованные и не в архиве. */
  seeAlso: MaterialCard[]
  skillsLeadsTo: number[]
  skillsRequires: number[]
}

/** Короткая карточка для списков: без текста. У закрытого — только замок и анонс (ТЗ 8.6). */
export type MaterialCard = Pick<MaterialView, 'id' | 'type' | 'title' | 'access' | 'cover' | 'tags' | 'minutes' | 'ageFrom' | 'ageTo' | 'announce'>

type Rel = { id: number; name?: string } | number
const ids = (v: unknown) => (Array.isArray(v) ? (v as Rel[]).map((x) => (typeof x === 'number' ? x : x.id)) : [])
const names = (v: unknown) =>
  Array.isArray(v) ? (v as Rel[]).flatMap((x) => (typeof x === 'object' && x.name ? [x.name] : [])) : []
const str = (v: unknown) => (typeof v === 'string' ? v : '')

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** HTML статьи в едином формате разметки (ТЗ 9.5); картинки — по подписанным ссылкам. */
export function richTextToHtml(state: unknown): string {
  if (!state || typeof state !== 'object' || !('root' in state)) return ''
  return convertLexicalToHTML({
    data: state as Parameters<typeof convertLexicalToHTML>[0]['data'],
    disableContainer: true,
    disableIndent: true,
    disableTextAlign: true,
    converters: ({ defaultConverters }) => ({
      ...defaultConverters,
      upload: ({ node }) => {
        const img = clientImage((node as { value?: MediaDoc }).value)
        if (!img) return ''
        if (img.video) return `<video src="${img.src}" autoplay muted loop playsinline></video>`
        return `<img src="${img.src}"${img.srcSet ? ` srcset="${img.srcSet}" sizes="100vw"` : ''} alt="${escapeHtml(img.alt ?? '')}" loading="lazy">`
      },
    }),
  })
}

export function toCard(doc: Record<string, unknown>): MaterialCard {
  return {
    id: doc.id as number,
    type: doc.type as MaterialView['type'],
    title: str(doc.title),
    access: doc.access === 'paid' ? 'paid' : 'free',
    cover: clientImage(doc.cover as MediaDoc),
    tags: names(doc.tags),
    minutes: (doc.minutes as number | null) ?? null,
    ageFrom: (doc.ageFrom as number | null) ?? null,
    ageTo: (doc.ageTo as number | null) ?? null,
    announce: str(doc.announce),
  }
}

/** Полный вид материала. Вызывать только после проверки доступа: внутри — подписанные ссылки на медиа. */
export function toView(doc: Record<string, unknown>): MaterialView {
  const audio = doc.audio as MediaDoc | null
  return {
    ...toCard(doc),
    steps: ((doc.steps as { image?: MediaDoc; text?: string }[] | undefined) ?? []).map((s) => ({
      image: clientImage(s.image),
      text: str(s.text),
    })),
    bodyHtml: doc.type === 'exercise' ? '' : richTextToHtml(doc.body),
    howToKnow: str(doc.howToKnow),
    ifNotWorking: str(doc.ifNotWorking),
    easierVariant: str(doc.easierVariant),
    whenToSeeDoctor: str(doc.whenToSeeDoctor),
    audio:
      audio && typeof audio === 'object' && audio.mimeType?.startsWith('audio/')
        ? { src: signedMediaPath(audio.id, 'original'), mimeType: audio.mimeType, mediaId: audio.id }
        : null,
    seeAlso: (Array.isArray(doc.seeAlso) ? (doc.seeAlso as Record<string, unknown>[]) : [])
      .filter((d) => typeof d === 'object' && d._status === 'published' && !d.archived)
      .map(toCard),
    skillsLeadsTo: ids(doc.skillsLeadsTo),
    skillsRequires: ids(doc.skillsRequires),
  }
}
