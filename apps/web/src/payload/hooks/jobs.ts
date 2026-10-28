import { alert } from '@mama/shared'
import type { CollectionAfterChangeHook } from 'payload'
import { AUDIT_SLUG } from './audit'

/** Задача отложенной публикации упала — запись в журнал (видит автор) и алерт исполнителю. */
export const scheduledPublishFailed: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc.taskSlug !== 'schedulePublish' || !doc.hasError || previousDoc?.hasError) return doc
  const message = String((doc.error as { message?: string } | null)?.message ?? 'ошибка').slice(0, 300)
  const materialId = (doc.input as { doc?: { value?: string | number } } | null)?.doc?.value
  await req.payload.create({
    collection: AUDIT_SLUG as 'users',
    data: { user: 'система', action: `отложенная публикация не удалась: ${message}`, target: 'materials', docId: String(materialId ?? '') } as never,
    overrideAccess: true,
    req,
  })
  void alert('scheduled-publish', `Отложенная публикация материала ${materialId} не удалась: ${message}`)
  return doc
}
