import { buildSummary, getSettings } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import type { AdminViewServerProps } from 'payload'
import { AdminPage, cellStyle, tableStyle } from './AdminPage'

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <table style={{ ...tableStyle, marginBottom: 24 }}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} style={cellStyle}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td style={cellStyle} colSpan={head.length}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={cellStyle}>
                  {c}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

/**
 * Сводка автора (ТЗ 11.3, метрики ТЗ 14): только агрегаты и обезличенные счётчики (ТЗ 11.2).
 * Отдельные мамы не видны — ни ID, ни дат рождения, ни запросов.
 */
export async function SummaryView(props: AdminViewServerProps) {
  const db = getDb()
  const [s, settings] = await Promise.all([buildSummary(db), getSettings(db)])
  const share = s.users.total ? Math.round((s.feed.total / s.users.total) * 100) : 0

  return (
    <AdminPage props={props} title="Сводка">
      <p style={{ maxWidth: 720, opacity: 0.8 }}>За последние 30 дней. Только общие числа: кто именно что делал, не хранится.</p>

      <h3>Пользователи и лента</h3>
      <Table
        head={['Показатель', 'Значение']}
        empty=""
        rows={[
          ['Пользователей всего', s.users.total],
          ...(s.users.testers ? [['из них тестировщиков', s.users.testers] as [string, number]] : []),
          ['Заходили за последнюю неделю', s.users.activeWeek],
          ['Подписаны на ленту', `${s.feed.total} (${share}%)`],
          ['Отписались от ленты за 30 дней', s.feed.unsubscribed30],
          ['Активных подписок', s.subscriptionsActive],
        ]}
      />
      <Table head={['Лента: возраст малыша', 'Подписаны']} empty="Пока никто не подписан." rows={s.feed.bySection.map((r) => [r.section, r.count])} />

      <h3>Популярные материалы</h3>
      <Table head={['Материал', 'Просмотры', 'Прослушивания']} empty="Пока нет просмотров." rows={s.popular.map((r) => [r.title, r.views, r.listens])} />

      <h3>Трудные упражнения</h3>
      <Table
        head={['Упражнение', '«Пока не получается»', '«Получилось»']}
        empty="Пока никто не отмечал «Пока не получается»."
        rows={s.hard.map((r) => [r.title, r.hard, r.done])}
      />

      <h3>Чего ищут, но нет</h3>
      <Table head={['Тема', 'Нажали «Хочу материал»']} empty="Пока пусто." rows={s.wanted.map((r) => [r.topic, r.count])} />

      <h3>Наполнение разделов</h3>
      <Table
        head={['Раздел', 'Опубликовано', '']}
        empty=""
        rows={s.sections.map((r) => [
          r.section,
          r.count,
          r.count === 0 ? 'пустой' : r.count < settings.smallSectionMin ? `меньше ${settings.smallSectionMin}${settings.hideSmallSections ? ' — скрыт (Р11)' : ''}` : '',
        ])}
      />

      <h3>Материалы для ленты по возрасту</h3>
      <p>
        Лента присылает материал, если его возраст включает возраст малыша, не чаще {settings.feedPerWeek} раз в неделю, и не
        повторяет его. Материал «4–9» считается в каждом месяце с 4 по 8. Закрытые приходят только с подпиской.
      </p>
      <Table
        head={['Возраст, мес.', 'Бесплатные', 'По подписке', '']}
        empty=""
        rows={s.feedMaterials.map((r) => [
          r.month,
          r.free,
          r.paid,
          r.free + r.paid === 0 ? 'лента молчит' : '',
        ])}
      />
    </AdminPage>
  )
}
