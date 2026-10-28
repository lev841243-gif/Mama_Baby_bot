import type { CollectionConfig } from 'payload'
import { isAuthor, isAuthorField } from '../payload/access'
import { auditCollectionChange } from '../payload/hooks/audit'

/**
 * Учётные записи админки: автор и исполнитель (ТЗ 4, 13). Мамы здесь не хранятся.
 * Вход — по личной учётной записи с 2FA (плагин payload-totp, forceSetup).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Пользователь админки', plural: 'Пользователи админки' },
  admin: { useAsTitle: 'email', group: 'Служебное', defaultColumns: ['email', 'role', 'updatedAt'] },
  auth: { maxLoginAttempts: 5, lockTime: 15 * 60 * 1000, tokenExpiration: 12 * 60 * 60 },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: isAuthor,
    // Себя может править каждый; других — только автор.
    update: ({ req }) => (req.user?.role === 'author' ? true : req.user ? { id: { equals: req.user.id } } : false),
    delete: isAuthor,
  },
  hooks: { afterChange: [auditCollectionChange] },
  fields: [
    {
      name: 'role',
      label: 'Роль',
      type: 'select',
      required: true,
      defaultValue: 'author',
      access: { update: isAuthorField },
      options: [
        { label: 'Автор', value: 'author' },
        { label: 'Исполнитель', value: 'developer' },
      ],
    },
    {
      name: 'tgId',
      label: 'Ваш Telegram ID',
      type: 'number',
      admin: {
        description: 'Для тестовой отправки анонса себе в бот. Узнать ID можно у @userinfobot. Сначала нажмите /start в боте.',
      },
    },
  ],
}
