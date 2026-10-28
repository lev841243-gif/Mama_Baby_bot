import type { PayloadRequest } from 'payload'
import { totpAccess } from 'payload-totp'

/** Пользователь админки прошёл и пароль, и 2FA. Для своих экранов, server actions и эндпоинтов. */
export async function isVerifiedAdmin(req: Pick<PayloadRequest, 'payload' | 'user'>): Promise<boolean> {
  if (!req.user) return false
  return Boolean(await totpAccess()({ req } as never))
}
