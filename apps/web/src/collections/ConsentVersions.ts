import { CONSENT_ITEMS, CONFIG_KEYS, compareVersions, resolveConsentVersions, type ConsentType } from '@mama/shared'
import { APIError, type CollectionAfterChangeHook, type CollectionConfig } from 'payload'
import { isAdmin, isAuthor, never } from '../payload/access'
import { auditCollectionChange } from '../payload/hooks/audit'
import { syncAppSettings } from '../payload/hooks/sync'

/** Пересчитать действующие версии и отдать их боту и приложению. */
const syncVersions: CollectionAfterChangeHook = async ({ req, doc }) => {
  const all = await req.payload.find({ collection: 'consent-versions', limit: 1000, pagination: false, req, depth: 0 })
  const rows = all.docs.map((d) => ({
    type: d.type as ConsentType,
    version: String(d.version),
    significant: Boolean(d.significant),
  }))
  await syncAppSettings(req, { [CONFIG_KEYS.consentVersions]: resolveConsentVersions(rows) })
  return doc
}

/**
 * Версии согласий (ТЗ 6.6, Р8). Каждая новая версия — новая запись; старые не правятся.
 * «Существенная» — все, кто принял более раннюю версию, проходят согласие заново при следующем действии.
 */
export const ConsentVersions: CollectionConfig = {
  slug: 'consent-versions',
  labels: { singular: 'Версия согласия', plural: 'Версии согласий' },
  admin: { useAsTitle: 'version', group: 'Служебное', defaultColumns: ['type', 'version', 'significant', 'createdAt'] },
  defaultSort: '-createdAt',
  access: { read: isAdmin, create: isAuthor, update: never, delete: never },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        const prev = await req.payload.find({
          collection: 'consent-versions',
          where: { type: { equals: data.type } },
          limit: 1000,
          pagination: false,
          req,
          depth: 0,
        })
        const bigger = prev.docs.find((d) => compareVersions(String(d.version), String(data.version)) >= 0)
        if (bigger) throw new APIError(`Номер версии должен быть больше ${bigger.version}`, 400, undefined, true)
        return data
      },
    ],
    afterChange: [syncVersions, auditCollectionChange],
  },
  fields: [
    {
      name: 'type',
      label: 'Согласие',
      type: 'select',
      required: true,
      options: CONSENT_ITEMS.map((i) => ({ label: i.title, value: i.type })),
    },
    {
      name: 'version',
      label: 'Номер версии',
      type: 'text',
      required: true,
      admin: { description: 'Например, 1.0. Номер должен быть больше прежнего.' },
      validate: (v: unknown) => (typeof v === 'string' && /^\d+(\.\d+){0,2}$/.test(v)) || 'Формат: 1.0 или 1.2.3',
    },
    {
      name: 'significant',
      label: 'Существенное изменение — спросить согласие заново',
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'note', label: 'Что изменилось', type: 'textarea' },
  ],
}
