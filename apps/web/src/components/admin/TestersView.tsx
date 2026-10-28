import { countTesters, getSettings } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import type { AdminViewServerProps } from 'payload'
import { deleteTestersAction } from './actions'
import { AdminPage } from './AdminPage'

const ERRORS: Record<string, string> = {
  confirm: 'Отметьте галочку подтверждения.',
  changed: 'Пока вы смотрели, число тестировщиков изменилось. Проверьте ещё раз.',
}

/**
 * «Удалить данные тестировщиков» (ТЗ 14, приёмка 36). Удаляет всех, кто вошёл во время тестирования,
 * со всеми их данными. Материалы, тексты, настройки и список доступа не трогает.
 */
export async function TestersView(props: AdminViewServerProps) {
  const db = getDb()
  const [n, settings] = await Promise.all([countTesters(db), getSettings(db)])
  const { deleted, error } = (props.searchParams ?? {}) as Record<string, string | undefined>

  return (
    <AdminPage props={props} title="Тестировщики">
      <div style={{ maxWidth: 720 }}>
        {deleted !== undefined && <p style={{ fontWeight: 600 }}>Удалено: {deleted}.</p>}
        {error && <p style={{ color: 'var(--theme-error-500)' }}>{ERRORS[error] ?? 'Не получилось.'}</p>}
        <p>
          Сейчас в базе тестировщиков: <b>{n}</b>.{' '}
          {settings.testerPhase
            ? 'Идёт тестирование: все новые пользователи помечаются тестировщиками.'
            : 'Тестирование выключено: новые пользователи — обычные мамы.'}
        </p>
        <p>
          Кнопка физически удаляет тестировщиков со всеми их данными: согласиями, датой рождения малыша, закладками,
          отметками. Записи об оплате остаются без привязки к человеку. Материалы, тексты и настройки не меняются.
          Восстановить удалённое нельзя.
        </p>
        <p>Перед бета-тестом: удалите данные, выключите «Идёт тестирование», включите закрытый режим и добавьте мам в список доступа.</p>
        {n > 0 && (
          <form action={deleteTestersAction} style={{ marginTop: 24 }}>
            <input type="hidden" name="expected" value={n} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" name="confirm" value="yes" required />
              Понимаю: данные {n} тестировщиков удалятся безвозвратно
            </label>
            <button type="submit" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>
              Удалить данные тестировщиков
            </button>
          </form>
        )}
      </div>
    </AdminPage>
  )
}
