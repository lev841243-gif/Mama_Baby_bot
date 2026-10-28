import type { CollectionConfig } from 'payload'
import { isAdmin, never } from '../payload/access'

/**
 * Посты канала t.me/detimam_pro (ТЗ 9.9). Сюда попадают и перенесённые из выгрузки, и новые —
 * их присылает бот-админ канала («Входящие из канала»). В приложение пост сам не попадает:
 * из него собирается черновик материала, публикует автор.
 */
export const ChannelPosts: CollectionConfig = {
  slug: 'channel-posts',
  labels: { singular: 'Пост канала', plural: 'Посты канала' },
  admin: {
    useAsTitle: 'preview',
    group: 'Канал',
    defaultColumns: ['postId', 'preview', 'status', 'skipReason', 'edited', 'date'],
    listSearchableFields: ['text'],
    description: 'Входящие — новые посты, ещё не собранные в статьи. Пропущенные — с причиной.',
  },
  defaultSort: '-postId',
  access: { read: isAdmin, create: never, update: isAdmin, delete: never },
  fields: [
    { name: 'postId', label: 'Номер поста', type: 'number', required: true, unique: true, index: true },
    { name: 'url', label: 'Ссылка', type: 'text', admin: { readOnly: true } },
    { name: 'date', label: 'Дата', type: 'date', admin: { readOnly: true } },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Входящие', value: 'inbox' },
        { label: 'Нарезан на блоки', value: 'blocks' },
        { label: 'Собран в статью', value: 'used' },
        { label: 'Пропущен', value: 'skipped' },
      ],
    },
    { name: 'skipReason', label: 'Почему пропущен', type: 'text', admin: { readOnly: true } },
    { name: 'source', label: 'Откуда', type: 'select', options: [{ label: 'Выгрузка', value: 'import' }, { label: 'Бот в канале', value: 'live' }] },
    { name: 'preview', label: 'Начало', type: 'text', admin: { readOnly: true } },
    { name: 'text', label: 'Текст поста', type: 'textarea', admin: { readOnly: true, rows: 10 } },
    { name: 'carousel', label: 'Карусель', type: 'checkbox', admin: { readOnly: true } },
    {
      name: 'needsReview',
      label: 'Требует проверки',
      type: 'checkbox',
      admin: { description: 'Текст распознан с картинок или его нет — пришлите исходный текст и поправьте блоки.' },
    },
    { name: 'photos', label: 'Картинки', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'edited',
      label: 'Пост изменён',
      type: 'checkbox',
      admin: { description: 'Автор поправил пост в канале. Решите, обновлять ли материал; снимите галочку.' },
    },
    { name: 'editedText', label: 'Новый текст поста', type: 'textarea', admin: { readOnly: true, condition: (d) => Boolean(d?.edited) } },
    { name: 'mediaGroupId', type: 'text', index: true, admin: { hidden: true } },
    { name: 'buttonMaterial', label: 'Кнопка «Открыть в приложении» ведёт на материал', type: 'number', admin: { readOnly: true } },
  ],
}
