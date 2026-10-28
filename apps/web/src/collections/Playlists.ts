import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditCollectionChange, auditCollectionDelete } from '../payload/hooks/audit'

const yandexMusic = (v: unknown) =>
  (typeof v === 'string' && /^https:\/\/music\.yandex\.(ru|com|by|kz)\/\S+$/.test(v)) ||
  'Нужна ссылка вида https://music.yandex.ru/…'

/** «Потешки и музыка» (ТЗ 8.5): только ссылки на плейлисты Яндекс Музыки, файлов музыки не храним. */
export const Playlists: CollectionConfig = {
  slug: 'playlists',
  labels: { singular: 'Плейлист', plural: 'Плейлисты' },
  admin: { useAsTitle: 'title', group: 'Контент', defaultColumns: ['title', 'kind', 'order', 'hidden'] },
  defaultSort: 'order',
  access: { read: isAdmin, create: isAuthor, update: isAuthor, delete: isAuthor },
  hooks: { afterChange: [auditCollectionChange], afterDelete: [auditCollectionDelete] },
  fields: [
    { name: 'title', label: 'Название', type: 'text', required: true },
    { name: 'url', label: 'Ссылка на плейлист в Яндекс Музыке', type: 'text', required: true, validate: yandexMusic },
    { name: 'description', label: 'Пояснение', type: 'textarea' },
    {
      name: 'kind',
      label: 'Вид',
      type: 'select',
      defaultValue: 'nursery',
      options: [
        { label: 'Потешки', value: 'nursery' },
        { label: 'Стихи', value: 'poems' },
        { label: 'Колыбельные', value: 'lullabies' },
        { label: 'Музыка', value: 'music' },
      ],
    },
    { name: 'order', label: 'Порядок', type: 'number', defaultValue: 100 },
    { name: 'hidden', label: 'Скрыт', type: 'checkbox', defaultValue: false },
  ],
}
