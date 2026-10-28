import { totpAccess } from 'payload-totp'
import type { Access, FieldAccess, PayloadRequest } from 'payload'

// Роли админки (ТЗ 4, 13): автор — всё; исполнитель — техническая поддержка, без изменения текстов автора.
// Исключение для исполнителя — стартовый контент: черновики можно, публикует только автор.

type Role = 'author' | 'developer'
const role = (req: PayloadRequest): Role | undefined => (req.user as { role?: Role } | null)?.role

export const isAdmin: Access = ({ req }) => Boolean(req.user)
export const isAuthor: Access = ({ req }) => role(req) === 'author'
export const isAuthorField: FieldAccess = ({ req }) => role(req) === 'author'
export const never: Access = () => false

/** Материалы: автор — всё; исполнитель — только черновики, опубликованное не трогает. */
export const canEditDraft: Access = ({ req, data }) => {
  const r = role(req)
  if (r === 'author') return true
  if (r !== 'developer') return false
  if ((data as { _status?: string } | undefined)?._status === 'published') return false
  return { _status: { not_equals: 'published' } }
}

export const canCreateDraft: Access = ({ req, data }) => {
  const r = role(req)
  if (r === 'author') return true
  return r === 'developer' && (data as { _status?: string } | undefined)?._status !== 'published'
}

/**
 * 2FA для запросов из админки и API, но не для серверного Local API: отложенную публикацию (задача Payload)
 * выполняет сервер от имени автора без 2FA-сессии — обычные права ролей при этом действуют.
 * Используется вместе с custom.totp.disableAccessWrapper у коллекции.
 */
export const totpUnlessLocal =
  (inner: Access): Access =>
  (args) =>
    args.req.payloadAPI === 'local' ? inner(args) : totpAccess(inner)(args)
