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
    {
      type: 'collapsible',
      label: 'Календарь, новости автора, окно согласий (этап 2)',
      fields: [
        {
          name: 'calendarEnabled',
          label: 'Календарь навыков работает',
          type: 'checkbox',
          defaultValue: d.calendarEnabled,
          admin: {
            description:
              'Пункт «Календарь навыков» в окне согласий, «Записать навык» в боте, экран календаря. Сейчас включён для тестирования; голосовые распознаются шаблоном (сервис речи — после Р4). Для мам — только после решения юриста (Р23).',
          },
        },
        {
          name: 'authorNews',
          label: 'Новости автора (Р6)',
          type: 'checkbox',
          defaultValue: d.authorNews,
          admin: { description: 'Пункт «Новости автора» в окне согласий и разовые рассылки. Нужно согласие юриста.' },
        },
        {
          name: 'acceptAllSkipsOptional',
          label: 'Календарь и новости автора — не через «Принять всё» (Р27)',
          type: 'checkbox',
          defaultValue: d.acceptAllSkipsOptional,
          admin: { description: 'Если юрист скажет, что эти согласия даются только своей галочкой.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Поиск (этап 3)',
      fields: [
        {
          name: 'semanticSearch',
          label: 'Поиск по смыслу работает',
          type: 'checkbox',
          defaultValue: d.semanticSearch,
          admin: {
            description:
              'Мама пишет своими словами и получает 1–3 материала. Подбор только по сходству с материалами, без генеративного ИИ; запрос не сохраняется. Выключено или сервис недоступен — поиск по словам.',
          },
        },
        {
          name: 'searchMinSimilarity',
          label: 'Порог сходства (0–1)',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: d.searchMinSimilarity,
          admin: { description: 'Выше — меньше лишнего, но чаще «Такой статьи пока нет». Подбирается тестом «25 из 30».' },
        },
        { name: 'searchPerDay', label: 'Запросов в день на маму', type: 'number', min: 1, max: 1000, defaultValue: d.searchPerDay },
      ],
    },
    {
      type: 'collapsible',
      label: 'Хранение данных (Р9, Р10)',
      fields: [
        {
          name: 'inactiveCleanup',
          label: 'Удалять данные неактивных (Р9)',
          type: 'checkbox',
          defaultValue: d.inactiveCleanup,
          admin: {
            description:
              'Мама без действий в боте и приложении получает предупреждение, через 2 недели её данные удаляются, как при отзыве согласия (записи об оплате остаются). Включать после решения заказчицы и юриста.',
          },
        },
        { name: 'inactiveMonths', label: 'Через сколько месяцев без действий', type: 'number', min: 1, max: 36, defaultValue: d.inactiveMonths },
        {
          name: 'revocationLog',
          label: 'Журнал отзывов согласия (Р10)',
          type: 'checkbox',
          defaultValue: d.revocationLog,
          admin: { description: 'Только число отзывов по типу согласия и дню, без мам. Включать, если юрист скажет, что журнал нужен.' },
        },
      ],
    },
  ],
}
