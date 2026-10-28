import { MATERIAL_TYPES, isAged, readingMinutes } from '@mama/shared/content'
import type { CollectionBeforeChangeHook, CollectionConfig, Validate } from 'payload'
import { canCreateDraft, canEditDraft, isAdmin, never } from '../payload/access'
import { auditCollectionChange } from '../payload/hooks/audit'
import { lexicalPlainText } from '../lib/lexical-text'

// Материалы (ТЗ 9.1–9.4). Мама видит только опубликованные и не в архиве; черновики — только админка.
// Валидация «обязательно для типа» срабатывает при публикации: черновик можно сохранить недописанным.

type Data = { type?: string; inFeed?: boolean; ageFrom?: number | null; ageTo?: number | null }

const forExercise = (data: Partial<Data> | undefined) => data?.type === 'exercise'
const notExercise = (data: Partial<Data> | undefined) => Boolean(data?.type) && data?.type !== 'exercise'

const requiredFor =
  (pred: (d: Partial<Data> | undefined) => boolean, message: string): Validate =>
  (value, { data }) => {
    if (!pred(data as Data)) return true
    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
    return empty ? message : true
  }

const computeMinutes: CollectionBeforeChangeHook = ({ data }) => {
  // Для статей и практик время чтения считается само, если автор не задала его (ТЗ 9.3).
  if (data.type !== 'exercise' && !data.minutesManual) {
    const chars = lexicalPlainText(data.body).length
    data.minutes = chars ? readingMinutes(chars) : null
  }
  return data
}

export const Materials: CollectionConfig = {
  slug: 'materials',
  labels: { singular: 'Материал', plural: 'Материалы' },
  admin: {
    useAsTitle: 'title',
    group: 'Контент',
    defaultColumns: ['title', 'type', 'ageFrom', 'ageTo', 'access', '_status', 'archived', 'updatedAt'],
    listSearchableFields: ['title'],
    // Предпросмотр «как в приложении» и анонса в боте (ТЗ 9.4).
    preview: (doc) => `/preview/material/${doc.id}`,
    description: 'Удалять нельзя — убирайте в архив: материал пропадёт из списков и ленты, в закладках мам будет «Материал больше недоступен».',
  },
  defaultSort: 'order',
  versions: {
    // История правок с откатом и отложенная публикация (ТЗ 9.4).
    drafts: { schedulePublish: true },
    maxPerDoc: 100,
  },
  access: { read: isAdmin, create: canCreateDraft, update: canEditDraft, delete: never, readVersions: isAdmin },
  hooks: { beforeChange: [computeMinutes], afterChange: [auditCollectionChange] },
  fields: [
    { name: 'title', label: 'Название', type: 'text', required: true },
    {
      name: 'type',
      label: 'Тип',
      type: 'select',
      required: true,
      defaultValue: 'exercise',
      options: MATERIAL_TYPES.map((t) => ({ label: t.label, value: t.value })),
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Содержание',
          fields: [
            {
              name: 'cover',
              label: 'Обложка',
              type: 'upload',
              relationTo: 'media',
              validate: requiredFor(forExercise, 'У упражнения нужна обложка'),
            },
            {
              name: 'steps',
              label: 'Шаги',
              labels: { singular: 'Шаг', plural: 'Шаги' },
              type: 'array',
              maxRows: 6,
              admin: { condition: (data) => forExercise(data), description: '2–6 шагов: картинка и 1–3 строки.' },
              validate: (value: unknown, { data }: { data: Partial<Data> }) => {
                if (!forExercise(data)) return true
                const n = Array.isArray(value) ? value.length : 0
                return n >= 2 && n <= 6 ? true : 'У упражнения 2–6 шагов'
              },
              fields: [
                { name: 'image', label: 'Картинка или MP4', type: 'upload', relationTo: 'media', required: true },
                { name: 'text', label: 'Текст шага (1–3 строки)', type: 'textarea', required: true, maxLength: 400 },
              ],
            },
            {
              name: 'body',
              label: 'Текст',
              type: 'richText',
              admin: { condition: (data) => notExercise(data) },
              validate: requiredFor(notExercise, 'Нужен текст'),
            },
            {
              name: 'howToKnow',
              label: 'Как понять, что получается',
              type: 'textarea',
              admin: { condition: (data) => forExercise(data), description: '1–2 строки.' },
              validate: requiredFor(forExercise, 'Заполните «Как понять, что получается»'),
            },
            {
              name: 'ifNotWorking',
              label: 'Если не получается — успокаивающий текст',
              type: 'textarea',
              admin: { condition: (data) => forExercise(data), description: 'Необязательно. Пусто — общий текст из «Текстов».' },
            },
            {
              name: 'easierVariant',
              label: 'Облегчённый вариант',
              type: 'textarea',
              admin: { condition: (data) => forExercise(data) },
            },
            {
              name: 'whenToSeeDoctor',
              label: 'Когда показать врачу',
              type: 'textarea',
              admin: { condition: (data) => forExercise(data) },
            },
            {
              name: 'audio',
              label: 'Аудио',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { contains: 'audio' } },
            },
          ],
        },
        {
          label: 'Где показывать',
          fields: [
            {
              type: 'row',
              admin: { condition: (data) => isAged(data?.type) },
              fields: [
                {
                  name: 'ageFrom',
                  label: 'Возраст от, полных мес.',
                  type: 'number',
                  min: 0,
                  max: 17,
                  validate: requiredFor((d) => isAged(d?.type), 'Укажите возраст «от»'),
                },
                {
                  name: 'ageTo',
                  label: 'до, мес. (не включая)',
                  type: 'number',
                  min: 1,
                  max: 18,
                  validate: (value: unknown, { data }: { data: Partial<Data> }) => {
                    if (!isAged(data?.type)) return true
                    if (typeof value !== 'number') return 'Укажите возраст «до»'
                    if (typeof data.ageFrom === 'number' && value <= data.ageFrom) return '«До» должно быть больше «от»'
                    return true
                  },
                },
              ],
            },
            {
              name: 'tags',
              label: 'Теги (1–3)',
              type: 'relationship',
              relationTo: 'tags',
              hasMany: true,
              maxRows: 3,
              filterOptions: { hidden: { not_equals: true } },
              validate: (value: unknown) => {
                const n = Array.isArray(value) ? value.length : 0
                return n >= 1 && n <= 3 ? true : 'Нужно 1–3 тега'
              },
            },
            {
              name: 'skillsLeadsTo',
              label: 'Навыки «ведёт к»',
              type: 'relationship',
              relationTo: 'skills',
              hasMany: true,
              admin: { condition: (data) => forExercise(data) },
              filterOptions: { hidden: { not_equals: true } },
            },
            {
              name: 'skillsRequires',
              label: 'Навыки «нужно уметь» (необязательно)',
              type: 'relationship',
              relationTo: 'skills',
              hasMany: true,
              admin: { condition: (data) => forExercise(data) },
              filterOptions: { hidden: { not_equals: true } },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'order',
                  label: 'Порядок',
                  type: 'number',
                  required: true,
                  defaultValue: 100,
                  admin: { description: 'Меньше — выше в списке и раньше в ленте.' },
                },
                {
                  name: 'minutes',
                  label: 'Время, мин',
                  type: 'number',
                  min: 1,
                  admin: { description: 'Для статей и практик считается само.' },
                },
                {
                  name: 'minutesManual',
                  label: 'Время задаю сама',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { condition: (data) => notExercise(data) },
                },
              ],
            },
          ],
        },
        {
          label: 'Анонс и лента',
          fields: [
            {
              name: 'announce',
              label: 'Анонс (2–3 строки)',
              type: 'textarea',
              maxLength: 400,
              validate: (value: unknown, { data }: { data: Partial<Data> }) =>
                data?.inFeed && !(typeof value === 'string' && value.trim()) ? 'Для ленты нужен анонс' : true,
            },
            { name: 'inFeed', label: 'Участвует в ленте', type: 'checkbox', defaultValue: false },
          ],
        },
        {
          label: 'Связи и источники',
          fields: [
            {
              name: 'seeAlso',
              label: 'См. также (1–3 материала)',
              type: 'relationship',
              relationTo: 'materials',
              hasMany: true,
              maxRows: 3,
              filterOptions: ({ id }) => ({ id: { not_equals: id } }),
            },
            {
              name: 'sources',
              label: 'Источники — посты канала',
              labels: { singular: 'Пост', plural: 'Посты' },
              type: 'array',
              fields: [
                { name: 'url', label: 'Ссылка на пост', type: 'text', required: true },
                { name: 'postId', label: 'Номер поста', type: 'number' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'access',
      label: 'Доступ',
      type: 'select',
      required: true,
      defaultValue: 'free',
      options: [
        { label: 'Бесплатно', value: 'free' },
        { label: 'По подписке', value: 'paid' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'archived',
      label: 'В архиве',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Материал пропадает из списков и ленты.' },
    },
    {
      name: 'tools',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/MaterialTools#MaterialTools' } },
    },
  ],
}
