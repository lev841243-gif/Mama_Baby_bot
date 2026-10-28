import 'server-only'
import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'
import { isVerifiedAdmin } from './admin-verified'

export type AdminUser = { id: number; email: string; role: 'author' | 'developer'; tgId?: number | null }

export async function getAdmin(): Promise<{ payload: Payload; user: AdminUser } | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || !(await isVerifiedAdmin({ payload, user }))) return null
  return { payload, user: user as unknown as AdminUser }
}
