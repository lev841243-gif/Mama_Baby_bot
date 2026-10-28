import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { isVerifiedAdmin } from '@/lib/admin-verified'

/** Обёртка своих экранов админки: меню Payload, проверка входа и 2FA. */
export async function AdminPage({
  props,
  title,
  children,
}: {
  props: AdminViewServerProps
  title: string
  children: React.ReactNode
}) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult
  if (!(await isVerifiedAdmin(req))) redirect('/admin')
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: '24px 0' }}>{title}</h1>
        {children}
      </Gutter>
    </DefaultTemplate>
  )
}

export const tableStyle: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', maxWidth: 720 }
export const cellStyle: React.CSSProperties = { borderBottom: '1px solid var(--theme-elevation-150)', padding: '8px 12px', textAlign: 'left' }
