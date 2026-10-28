import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthor, never } from '../payload/access'
import { auditCollectionChange } from '../payload/hooks/audit'

/** Словарь тегов (ТЗ 9.6). Свободный ввод тегов в материале не допускается — только отсюда. */
export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Тег', plural: 'Теги' },
  admin: { useAsTitle: 'name', group: 'Словари', defaultColumns: ['name', 'order', 'hidden'] },
  defaultSort: 'order',
  access: { read: isAdmin, create: isAuthor, update: isAuthor, delete: never },
  hooks: { afterChange: [auditCollectionChange] },
  fields: [
    { name: 'name', label: 'Название', type: 'text', required: true, unique: true },
    { name: 'order', label: 'Порядок', type: 'number', defaultValue: 100 },
    {
      name: 'hidden',
      label: 'Скрыт',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Скрытый тег не предлагается в материалах и поиске. Удалять теги нельзя: они уже в материалах.' },
    },
  ],
}
