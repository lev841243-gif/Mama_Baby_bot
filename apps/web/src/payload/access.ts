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
