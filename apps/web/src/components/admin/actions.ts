'use server'
import { addAccess, countTesters, deleteTesters, embedProvider, removeAccess, runSearchCheck, saveSearchCheckReport } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdmin } from '@/lib/admin-auth'
import { log } from '@/lib/server'

// Действия своих экранов админки. Каждое заново проверяет вход и 2FA: server action — это открытый POST.

async function requireAdmin() {
  const admin = await getAdmin()
  if (!admin) redirect('/admin')
  return admin
}

async function audit(action: string, target: string, title?: string) {
  const { payload, user } = await requireAdmin()
  await payload.create({ collection: 'audit-log', data: { user: user.email, action, target, title }, overrideAccess: true })
}

export async function addAccessAction(form: FormData) {
  await requireAdmin()
  const tgId = Number(String(form.get('tgId') ?? '').trim())
  const note = String(form.get('note') ?? '').trim()
  if (!Number.isSafeInteger(tgId) || tgId <= 0) redirect('/admin/access-list?error=id')
  await addAccess(getDb(), tgId, note || null)
  await audit('добавлен в список доступа', 'access-list', note || undefined)
  revalidatePath('/admin/access-list')
  redirect('/admin/access-list')
}

export async function removeAccessAction(form: FormData) {
  await requireAdmin()
  const tgId = Number(form.get('tgId'))
  if (!Number.isSafeInteger(tgId)) return
  await removeAccess(getDb(), tgId)
  await audit('удалён из списка доступа', 'access-list')
  revalidatePath('/admin/access-list')
}

export async function deleteTestersAction(form: FormData) {
  await requireAdmin()
  // Подтверждение: галочка «понимаю» и число, которое видел автор (на случай, если оно изменилось).
  if (form.get('confirm') !== 'yes') redirect('/admin/testers?error=confirm')
  const expected = Number(form.get('expected'))
  const db = getDb()
  if ((await countTesters(db)) !== expected) redirect('/admin/testers?error=changed')
  const n = await deleteTesters(db)
  log.info({ deleted: n }, 'tester data deleted')
  await audit(`удалены данные тестировщиков: ${n}`, 'testers')
  revalidatePath('/admin/testers')
  redirect(`/admin/testers?deleted=${n}`)
}

/** «Прогнать тест» поиска (ТЗ 10.1, приёмка 29): все запросы из «Проверки поиска» через поиск мамы. */
export async function runSearchCheckAction() {
  const { payload } = await requireAdmin()
  const { docs } = await payload.find({ collection: 'search-checks', depth: 1, limit: 500, pagination: false, sort: 'createdAt', overrideAccess: true })
  const checks = docs.map((d) => ({
    id: d.id,
    query: d.query,
    expected: (d.expected ?? []).map((m) => (typeof m === 'object' ? m.id : m)),
    expectedTitles: (d.expected ?? []).map((m) => (typeof m === 'object' ? m.title : `материал ${m}`)),
    expectNothing: Boolean(d.expectNothing),
  }))
  const db = getDb()
  const report = await runSearchCheck(db, embedProvider(), checks)
  await saveSearchCheckReport(db, report)
  log.info({ found: report.found, nothing: report.nothing, mode: report.mode }, 'search check run')
  await audit(`прогнан тест поиска: ${report.found.ok} из ${report.found.total}`, 'search-check')
  revalidatePath('/admin/search-check')
  redirect('/admin/search-check')
}
