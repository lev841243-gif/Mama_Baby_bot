import type { CollectionConfig } from 'payload'
import { isAdmin } from '../payload/access'
import { auditCollectionChange, auditCollectionDelete } from '../payload/hooks/audit'

/**
 * Тест поиска «25 из 30» (ТЗ 10.1, приёмка 29): запрос автора → материалы, которые должны быть в тройке.
 * Запросы пишет автор, это не данные мам. Прогон — экран «Проверка поиска» (/admin/search-check).
 */
export const SearchChecks: CollectionConfig = {
  slug: 'search-checks',
  labels: { singular: 'Запрос для проверки поиска', plural: 'Проверка поиска' },
  admin: {
    useAsTitle: 'query',
    group: 'Поиск',
    defaultColumns: ['query', 'expected', 'expectNothing'],
    description:
      'Как мамы спросили бы своими словами, и какой материал должен найтись. Нужно 30 запросов; результат — на экране «Проверка поиска».',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { afterChange: [auditCollectionChange], afterDelete: [auditCollectionDelete] },
  fields: [
    { name: 'query', label: 'Запрос', type: 'text', required: true, maxLength: 200 },
    {
      name: 'expected',
      label: 'Должен найтись (любой из)',
      type: 'relationship',
      relationTo: 'materials',
      hasMany: true,
      admin: { condition: (data) => !data?.expectNothing },
      validate: (value: unknown, { data }: { data: { expectNothing?: boolean } }) =>
        data?.expectNothing || (Array.isArray(value) && value.length > 0) ? true : 'Выберите материал или отметьте «Такой статьи нет»',
    },
    {
      name: 'expectNothing',
      label: 'Такой статьи нет — поиск должен ответить «Такой статьи пока нет»',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Несколько таких запросов помогают выбрать порог: без них поиск «находит» что-то всегда.' },
    },
    { name: 'note', label: 'Заметка', type: 'textarea' },
  ],
}
