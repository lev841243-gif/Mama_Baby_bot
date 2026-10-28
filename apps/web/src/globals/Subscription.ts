import { CONFIG_KEYS, DEFAULT_SUBSCRIPTION } from '@mama/shared'
import type { GlobalConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditGlobalChange } from '../payload/hooks/audit'
import { syncAppSettings } from '../payload/hooks/sync'

/**
 * Настройки подписки (ТЗ 8.6, 9.4): что входит и тарифы. Какие материалы закрыты — поле «Доступ» у материала.
 * TODO(Р22): цену, период и пробный период утверждает заказчица.
 */
export const Subscription: GlobalConfig = {
  slug: 'subscription',
  label: 'Подписка',
  admin: { group: 'Настройки' },
  access: { read: isAdmin, update: isAuthor },
  versions: { max: 50 },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const plans = ((doc.plans ?? []) as Record<string, unknown>[]).map((p) => ({
          id: String(p.planId ?? ''),
          title: String(p.title ?? ''),
          periodDays: Number(p.periodDays ?? 0),
          priceRub: Number(p.priceRub ?? 0),
          priceStars: Number(p.priceStars ?? 0),
        }))
        await syncAppSettings(req, { [CONFIG_KEYS.subscription]: { description: doc.description ?? '', plans } })
        return doc
      },
      auditGlobalChange,
    ],
  },
  fields: [
    {
      name: 'description',
      label: 'Что входит',
      type: 'textarea',
      defaultValue: DEFAULT_SUBSCRIPTION.description,
      admin: { description: 'Показывается на экране «Подписка» и на закрытых материалах.' },
    },
    {
      name: 'plans',
      label: 'Тарифы',
      labels: { singular: 'Тариф', plural: 'Тарифы' },
      type: 'array',
      minRows: 1,
      defaultValue: DEFAULT_SUBSCRIPTION.plans.map((p) => ({ ...p, planId: p.id, id: undefined })),
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'planId', label: 'Код', type: 'text', required: true, admin: { description: 'Латиницей, например month' } },
            { name: 'title', label: 'Период для мамы', type: 'text', required: true, admin: { description: 'Например «1 месяц»' } },
            { name: 'periodDays', label: 'Дней', type: 'number', required: true, min: 1 },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'priceRub', label: 'Цена, ₽', type: 'number', required: true, min: 0 },
            { name: 'priceStars', label: 'Цена, Telegram Stars (Р21)', type: 'number', min: 0 },
          ],
        },
      ],
    },
  ],
}
