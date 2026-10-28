import type { CollectionConfig } from 'payload'
import { isAdmin, isAuthor, never } from '../payload/access'
import { auditCollectionChange } from '../payload/hooks/audit'

/**
 * Справочник навыков (ТЗ 9.7): подбор «Что уже умеет малыш?», календарь (этап 2), связь «навык → материалы».
 * У навыка нет «нормального срока» — только название (правило 3.4).
 */
export const Skills: CollectionConfig = {
  slug: 'skills',
  labels: { singular: 'Навык', plural: 'Навыки' },
  admin: { useAsTitle: 'name', group: 'Словари', defaultColumns: ['name', 'order', 'tag', 'hidden'] },
  defaultSort: 'order',
  access: { read: isAdmin, create: isAuthor, update: isAuthor, delete: never },
  hooks: { afterChange: [auditCollectionChange] },
  fields: [
    { name: 'name', label: 'Навык', type: 'text', required: true, unique: true },
    { name: 'order', label: 'Порядок', type: 'number', defaultValue: 100 },
    {
      name: 'tag',
      label: 'Связанный тег',
      type: 'relationship',
      relationTo: 'tags',
      admin: { description: 'Например, «Ползание» — и навык, и тег.' },
    },
    { name: 'hidden', label: 'Скрыт', type: 'checkbox', defaultValue: false },
  ],
}
