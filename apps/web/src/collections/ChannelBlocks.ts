import type { CollectionConfig } from 'payload'
import { isAdmin, never } from '../payload/access'

/** Смысловые блоки постов (ТЗ 9.9, шаг 3): подзаголовок с его абзацами. У каждого — ссылка на пост. */
export const ChannelBlocks: CollectionConfig = {
  slug: 'channel-blocks',
  labels: { singular: 'Блок', plural: 'Блоки постов' },
  admin: { useAsTitle: 'heading', group: 'Канал', defaultColumns: ['post', 'order', 'heading', 'needsReview', 'used'] },
  defaultSort: 'id',
  access: { read: isAdmin, create: never, update: isAdmin, delete: never },
  fields: [
    { name: 'post', label: 'Пост', type: 'relationship', relationTo: 'channel-posts', required: true, index: true },
    { name: 'order', label: 'Порядок в посте', type: 'number', required: true },
    { name: 'heading', label: 'Подзаголовок', type: 'text' },
    {
      name: 'text',
      label: 'Текст',
      type: 'textarea',
      admin: { rows: 8, description: 'Текст поста как есть. Править — только если распознан с картинки.' },
    },
    { name: 'needsReview', label: 'Требует проверки (распознан с картинки)', type: 'checkbox' },
    { name: 'used', label: 'Уже в статье', type: 'checkbox', index: true },
    { name: 'material', label: 'Статья', type: 'relationship', relationTo: 'materials' },
  ],
}
