import type { CollectionConfig } from 'payload'

/** Учётные записи админки: автор и исполнитель (ТЗ 13). Мамы здесь не хранятся. */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Пользователь админки', plural: 'Пользователи админки' },
  admin: { useAsTitle: 'email', group: 'Служебное' },
  auth: true,
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => req.user?.role === 'author',
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => req.user?.role === 'author',
  },
  fields: [
    {
      name: 'role',
      label: 'Роль',
      type: 'select',
      required: true,
      defaultValue: 'author',
      options: [
        { label: 'Автор', value: 'author' },
        { label: 'Исполнитель', value: 'developer' },
      ],
    },
  ],
}
