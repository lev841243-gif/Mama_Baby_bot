import { CONFIG_KEYS, DEFAULT_EMERGENCY_TEXT, DEFAULT_RED_WORDS } from '@mama/shared'
import type { GlobalConfig } from 'payload'
import { isAdmin, isAuthor } from '../payload/access'
import { auditGlobalChange } from '../payload/hooks/audit'
import { syncAppSettings } from '../payload/hooks/sync'

/**
 * «Красные слова» и экстренный текст (ТЗ 10.3). Слово находится с учётом форм и опечаток:
 * достаточно одной формы («температура» найдёт «температурит»).
 */
export const RedWords: GlobalConfig = {
  slug: 'red-words',
  label: '«Красные слова»',
  admin: { group: 'Настройки' },
  access: { read: isAdmin, update: isAuthor },
  versions: { max: 50 },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const words = ((doc.words ?? []) as { phrase?: string }[]).map((w) => w.phrase?.trim() ?? '').filter(Boolean)
        await syncAppSettings(req, { [CONFIG_KEYS.redWords]: { words, emergencyText: doc.emergencyText ?? '' } })
        return doc
      },
      auditGlobalChange,
    ],
  },
  fields: [
    {
      name: 'emergencyText',
      label: 'Экстренный текст',
      type: 'textarea',
      required: true,
      defaultValue: DEFAULT_EMERGENCY_TEXT,
      admin: { rows: 6, description: 'Обязательно с номерами 103 и 112. Можно <b>жирный</b>.' },
      validate: (v: unknown) =>
        (typeof v === 'string' && v.includes('103') && v.includes('112')) || 'В тексте должны быть номера 103 и 112',
    },
    {
      name: 'words',
      label: 'Слова и фразы',
      labels: { singular: 'Слово или фраза', plural: 'Слова и фразы' },
      type: 'array',
      minRows: 1,
      defaultValue: DEFAULT_RED_WORDS.map((phrase) => ({ phrase })),
      fields: [{ name: 'phrase', label: 'Слово или фраза', type: 'text', required: true }],
    },
  ],
}
