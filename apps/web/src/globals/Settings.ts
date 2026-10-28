import { SETTINGS_KEYS, defaultSettings } from '@mama/shared'
import type { GlobalConfig } from 'payload'
import { isAdmin } from '../payload/access'
import { auditGlobalChange } from '../payload/hooks/audit'
import { syncAppSettings } from '../payload/hooks/sync'

const d = defaultSettings()

/** Переключатели проекта (ТЗ 14, 9.4, Р11). До первого сохранения действуют значения из env. */
export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Настройки проекта',
  admin: { group: 'Настройки' },
  access: { read: isAdmin, update: isAdmin },
  versions: { max: 50 },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const entries = Object.fromEntries(SETTINGS_KEYS.filter((k) => doc[k] !== undefined && doc[k] !== null).map((k) => [k, doc[k]]))
        await syncAppSettings(req, entries)
        return doc
      },
      auditGlobalChange,
    ],
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Закрытый режим и бета-версия (ТЗ 14)',
      fields: [
        {
          name: 'closedMode',
          label: 'Закрытый режим: бот и приложение только для списка доступа',
          type: 'checkbox',
          defaultValue: d.closedMode,
        },
        { name: 'betaBanner', label: 'Плашка и дисклеймер бета-версии', type: 'checkbox', defaultValue: d.betaBanner },
        {
          name: 'testerPhase',
          label: 'Идёт тестирование: новые пользователи — тестировщики',
          type: 'checkbox',
          defaultValue: d.testerPhase,
          admin: { description: 'Их данные удаляет кнопка «Удалить данные тестировщиков». Выключить перед бета-тестом с мамами.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Разделы и лента',
      fields: [
        {
          name: 'hideSmallSections',
          label: 'Не показывать маленькие разделы (Р11)',
          type: 'checkbox',
          defaultValue: d.hideSmallSections,
        },
        {
          name: 'smallSectionMin',
          label: 'Меньше скольки материалов раздел скрыт',
          type: 'number',
          min: 1,
          defaultValue: d.smallSectionMin,
        },
        {
          name: 'musicWidget',
          label: 'Встраивать виджет Яндекс Музыки (Р24)',
          type: 'checkbox',
          defaultValue: d.musicWidget,
          admin: { description: 'Только после проверки на iPhone и Android. Выключено — кнопка «Слушать в Яндекс Музыке».' },
        },
        {
          name: 'feedPerWeek',
          label: 'Лента: раз в неделю (этап 2)',
          type: 'number',
          min: 1,
          max: 7,
          defaultValue: d.feedPerWeek,
        },
      ],
    },
  ],
}
