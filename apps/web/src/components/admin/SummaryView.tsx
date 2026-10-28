import { countUsers } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import type { AdminViewServerProps } from 'payload'
import { AdminPage } from './AdminPage'

/** Сводка автора (ТЗ 11.3): только агрегаты и обезличенные счётчики, отдельные мамы не видны. */
export async function SummaryView(props: AdminViewServerProps) {
  const users = await countUsers(getDb())
  // TODO(шаг 10): разделы ленты по возрастам, подписки, популярные материалы, трудные упражнения, «чего ищут, но нет».
  return (
    <AdminPage props={props} title="Сводка">
      <p>
        Пользователей: <b>{users.total}</b>
        {users.testers > 0 && <> (из них тестировщиков: {users.testers})</>}
      </p>
      <p style={{ opacity: 0.7 }}>Подробная сводка появится по мере работы функций.</p>
    </AdminPage>
  )
}
