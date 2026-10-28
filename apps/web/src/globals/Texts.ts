import { CONFIG_KEYS, DEFAULT_TEXTS, TEXT_GROUPS, type TextKey } from '@mama/shared'
import type { GlobalConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditGlobalChange } from '../payload/hooks/audit'
import { syncAppSettings } from '../payload/hooks/sync'

const KEYS = Object.keys(DEFAULT_TEXTS) as TextKey[]

/**
 * Тексты бота и приложения (ТЗ 6.8). Пишет автор; по умолчанию — черновики из шаблона 07.
 * Пустое поле — значит текст по умолчанию. В фигурных скобках — подстановки, их не трогать.
 */
export const Texts: GlobalConfig = {
  slug: 'texts',
  label: 'Тексты бота и приложения',
  admin: { group: 'Настройки' },
  access: { read: isAdmin, update: isAuthor },
  versions: { max: 50 },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const texts = Object.fromEntries(KEYS.map((k) => [k, typeof doc[k] === 'string' ? doc[k] : '']))
        await syncAppSettings(req, { [CONFIG_KEYS.texts]: texts })
        return doc
      },
      auditGlobalChange,
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: TEXT_GROUPS.map((g) => ({
        label: g.label,
        fields: (Object.entries(g.texts) as [TextKey, string][]).map(([key, label]) => ({
          name: key,
          label,
          type: 'textarea' as const,
          defaultValue: DEFAULT_TEXTS[key],
          admin: { rows: DEFAULT_TEXTS[key].length > 120 ? 5 : 2 },
        })),
      })),
    },
  ],
}
