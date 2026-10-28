import { getSettings, listAccess } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import type { AdminViewServerProps } from 'payload'
import { addAccessAction, removeAccessAction } from './actions'
import { AdminPage, cellStyle, tableStyle } from './AdminPage'

/** Список доступа закрытого режима (ТЗ 14): Telegram ID исполнителя, автора и тестировщиков. */
export async function AccessListView(props: AdminViewServerProps) {
  const db = getDb()
  const [rows, settings] = await Promise.all([listAccess(db), getSettings(db)])
  const error = props.searchParams?.error

  return (
    <AdminPage props={props} title="Список доступа">
      <p style={{ maxWidth: 720 }}>
        {settings.closedMode
          ? 'Закрытый режим включён: бот и приложение работают только для этих Telegram ID.'
          : 'Закрытый режим выключен — бот открыт всем. Список начнёт действовать, когда режим включат в «Настройках проекта».'}{' '}
        Остальным бот отвечает «Бот пока в разработке» и ничего о них не записывает.
      </p>

      <form action={addAccessAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 24px' }}>
        <input name="tgId" inputMode="numeric" placeholder="Telegram ID" required style={{ padding: 8, minWidth: 180 }} />
        <input name="note" placeholder="Кто это (необязательно)" style={{ padding: 8, minWidth: 240 }} />
        <button type="submit" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }}>
          Добавить
        </button>
      </form>
      {error === 'id' && <p style={{ color: 'var(--theme-error-500)' }}>Telegram ID — это число, например 123456789.</p>}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cellStyle}>Telegram ID</th>
            <th style={cellStyle}>Кто</th>
            <th style={cellStyle}>Добавлен</th>
            <th style={cellStyle} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tgId}>
              <td style={cellStyle}>{r.tgId}</td>
              <td style={cellStyle}>{r.note}</td>
              <td style={cellStyle}>{r.addedAt.toLocaleDateString('ru-RU')}</td>
              <td style={cellStyle}>
                <form action={removeAccessAction}>
                  <input type="hidden" name="tgId" value={r.tgId} />
                  <button type="submit" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }}>
                    Убрать
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={cellStyle} colSpan={4}>
                Список пуст.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </AdminPage>
  )
}
