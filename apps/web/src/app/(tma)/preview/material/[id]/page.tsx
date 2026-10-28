import { getTexts } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { notFound, redirect } from 'next/navigation'
import { getAdmin } from '@/lib/admin-auth'
import { toView } from '@/lib/material-view'
import { MaterialPreview } from './MaterialPreview'

export const dynamic = 'force-dynamic'

/** Предпросмотр материала для автора (ТЗ 9.4): последняя сохранённая версия, в том числе черновик. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin()
  if (!admin) redirect('/admin')
  const { id } = await params
  const doc = await admin.payload.findByID({
    collection: 'materials',
    id: Number(id),
    draft: true,
    depth: 2,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!doc) notFound()
  const texts = await getTexts(getDb())
  return <MaterialPreview material={toView(doc as unknown as Record<string, unknown>)} texts={texts} status={String(doc._status ?? '')} />
}
