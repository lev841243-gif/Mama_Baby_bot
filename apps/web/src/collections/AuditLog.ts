import type { CollectionConfig } from 'payload'
import { isAdmin, never } from '../payload/access'
import { AUDIT_SLUG } from '../payload/hooks/audit'

/** Журнал действий (ТЗ 13). Пишется только хуками, руками не правится. */
export const AuditLog: CollectionConfig = {
  slug: AUDIT_SLUG,
  labels: { singular: 'Запись журнала', plural: 'Журнал действий' },
  admin: { useAsTitle: 'action', group: 'Служебное', defaultColumns: ['createdAt', 'user', 'action', 'target', 'title'] },
  defaultSort: '-createdAt',
  access: { read: isAdmin, create: never, update: never, delete: never },
  fields: [
    { name: 'user', label: 'Кто', type: 'text', required: true },
    { name: 'action', label: 'Действие', type: 'text', required: true },
    { name: 'target', label: 'Раздел', type: 'text', required: true },
    { name: 'docId', label: 'ID', type: 'text' },
    { name: 'title', label: 'Название', type: 'text' },
  ],
}
