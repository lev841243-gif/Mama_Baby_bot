import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

// Журнал действий в админке (ТЗ 13): кто и когда изменил материал, текст или настройку.
// История содержимого — в версиях Payload; здесь только «кто, что, когда».

export const AUDIT_SLUG = 'audit-log'

type Entry = { action: string; target: string; docId?: string; title?: string }

async function write(req: PayloadRequest, entry: Entry) {
  // Сид в миграциях пишется до схемы app и без пользователя — его в журнал не кладём.
  if (req.context?.seed) return
  const user = req.user as { id?: number | string; email?: string } | null
  await req.payload.create({
    collection: AUDIT_SLUG as 'users',
    data: { ...entry, user: user?.email ?? 'система' } as never,
    req,
    overrideAccess: true,
  })
}

const titleOf = (doc: Record<string, unknown>) =>
  String(doc.title ?? doc.name ?? doc.email ?? doc.filename ?? doc.version ?? '').slice(0, 200) || undefined

export const auditCollectionChange: CollectionAfterChangeHook = async ({ doc, req, operation, collection }) => {
  let action: string = operation === 'create' ? 'создание' : 'изменение'
  const status = (doc as { _status?: string })._status
  if (status === 'published') action += ' (опубликовано)'
  else if (status === 'draft') action += ' (черновик)'
  await write(req, { action, target: collection.slug, docId: String(doc.id), title: titleOf(doc) })
  return doc
}

export const auditCollectionDelete: CollectionAfterDeleteHook = async ({ doc, req, collection }) => {
  await write(req, { action: 'удаление', target: collection.slug, docId: String(doc.id), title: titleOf(doc) })
  return doc
}

export const auditGlobalChange: GlobalAfterChangeHook = async ({ doc, req, global }) => {
  await write(req, { action: 'изменение', target: global.slug })
  return doc
}
