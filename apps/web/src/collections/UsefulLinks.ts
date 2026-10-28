import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditCollectionChange, auditCollectionDelete } from '../payload/hooks/audit'

const https = (v: unknown) => (typeof v === 'string' && /^https:\/\/\S+$/.test(v)) || 'Ссылка должна начинаться с https://'

/** «Полезное» (ТЗ 8.7): консультации, курсы, книги — только ссылки, без продаж внутри приложения. */
export const UsefulLinks: CollectionConfig = {
  slug: 'useful-links',
  labels: { singular: 'Ссылка «Полезного»', plural: 'Полезное' },
  admin: { useAsTitle: 'title', group: 'Контент', defaultColumns: ['title', 'kind', 'order', 'hidden'] },
  defaultSort: 'order',
  access: { read: isAdmin, create: isAuthor, update: isAuthor, delete: isAuthor },
  hooks: { afterChange: [auditCollectionChange], afterDelete: [auditCollectionDelete] },
  fields: [
    { name: 'title', label: 'Название', type: 'text', required: true },
    { name: 'url', label: 'Ссылка', type: 'text', required: true, validate: https },
    { name: 'description', label: 'Пояснение', type: 'textarea' },
    {
      name: 'kind',
      label: 'Вид',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Консультации', value: 'consult' },
        { label: 'Курсы', value: 'course' },
        { label: 'Книги', value: 'book' },
        { label: 'Другое', value: 'other' },
      ],
    },
    { name: 'order', label: 'Порядок', type: 'number', defaultValue: 100 },
    { name: 'hidden', label: 'Скрыта', type: 'checkbox', defaultValue: false },
  ],
}
