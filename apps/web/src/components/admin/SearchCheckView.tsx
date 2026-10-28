import { getSearchCheckReports, getSettings } from '@mama/shared'
import { getDb } from '@mama/shared/db'
import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'
import { runSearchCheckAction } from './actions'
import { AdminPage, cellStyle } from './AdminPage'

const MODE: Record<string, string> = {
  semantic: 'по смыслу',
  words: 'по словам (поиск по смыслу выключен или нет сервиса векторов)',
  fallback: 'по словам — сервис векторов не ответил',
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' })
const sim = (x: number | null) => (x === null ? '—' : x.toFixed(3))

/**
 * Тест поиска «25 из 30» (ТЗ 10.1, приёмка 29). Запросы — коллекция «Проверка поиска», прогон — тот же поиск,
 * что у мамы. Таблица порогов показывает, что было бы при другом пороге, — порог меняется в «Настройках проекта».
 */
export async function SearchCheckView(props: AdminViewServerProps) {
  const db = getDb()
  const [{ current: r, previous }, settings] = await Promise.all([getSearchCheckReports(db), getSettings(db)])

  return (
    <AdminPage props={props} title="Проверка поиска">
      <div style={{ maxWidth: 960 }}>
        <p>
          Критерий ТЗ: из 30 запросов в 25 ожидаемый материал — в тройке результатов. Запросы и ожидаемые материалы —{' '}
          <Link href="/admin/collections/search-checks">в «Проверке поиска»</Link>. Порог сходства сейчас{' '}
          <b>{settings.searchMinSimilarity}</b>, меняется в «Настройках проекта» → «Поиск».
        </p>
        <form action={runSearchCheckAction} style={{ margin: '16px 0 24px' }}>
          <button type="submit" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>
            Прогнать тест
          </button>
        </form>

        {!r ? (
          <p>Тест ещё не прогоняли.</p>
        ) : (
          <>
            <h3 style={{ marginBottom: 8 }}>
              Нашлось: {r.found.ok} из {r.found.total}
              {r.nothing.total > 0 && ` · «Такой статьи пока нет»: ${r.nothing.ok} из ${r.nothing.total}`}
            </h3>
            <p style={{ opacity: 0.8 }}>
              {fmtDate(r.at)} · поиск {MODE[r.mode] ?? r.mode} · модель {r.model} · порог {r.threshold}
              {previous && ` · в прошлый раз (${fmtDate(previous.at)}, порог ${previous.threshold}): ${previous.found.ok} из ${previous.found.total}`}
            </p>
            {r.found.total < 30 && <p>Для приёмки нужно 30 запросов с ожидаемым материалом, сейчас {r.found.total}.</p>}

            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
              <thead>
                <tr>
                  {['', 'Запрос', 'Должен найтись', 'Что увидит мама', 'Ожидаемый: место и балл', 'Ближайшие по смыслу'].map((h) => (
                    <th key={h} style={cellStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.id} style={row.ok ? undefined : { background: 'var(--theme-error-50)' }}>
                    <td style={cellStyle}>{row.ok ? '✓' : '✗'}</td>
                    <td style={cellStyle}>
                      <Link href={`/admin/collections/search-checks/${row.id}`}>{row.query}</Link>
                    </td>
                    <td style={cellStyle}>
                      {row.expectNothing
                        ? '«Такой статьи пока нет»'
                        : row.expected.map((id, i) => (
                            <div key={id}>
                              <Link href={`/admin/collections/materials/${id}`}>{row.expectedTitles?.[i] ?? `материал ${id}`}</Link>
                            </div>
                          ))}
                    </td>
                    <td style={cellStyle}>{row.results.length ? row.results.map((m) => <div key={m.id}>{m.title}</div>) : '«Такой статьи пока нет»'}</td>
                    <td style={cellStyle}>{row.expectNothing ? '' : row.expectedRank ? `${row.expectedRank} · ${sim(row.expectedSim)}` : 'не в десятке'}</td>
                    <td style={{ ...cellStyle, fontSize: 12, opacity: 0.8 }}>
                      {row.near.slice(0, 5).map((n) => (
                        <div key={n.id}>
                          {sim(n.sim)} {n.title}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {r.thresholds.length > 0 && (
              <>
                <h3 style={{ marginTop: 32 }}>Что было бы при другом пороге</h3>
                <p style={{ opacity: 0.8 }}>
                  Выше порог — меньше лишнего, но чаще «Такой статьи пока нет». Выбирайте порог, при котором нашлось ≥ 25 из 30 и
                  верно отвечено на запросы «такой статьи нет». Не нашёлся нужный материал — добавьте ему фразы «Как мамы
                  спрашивают».
                </p>
                <table style={{ borderCollapse: 'collapse', maxWidth: 480 }}>
                  <thead>
                    <tr>
                      {['Порог', 'Нашлось', '«Такой статьи нет»'].map((h) => (
                        <th key={h} style={cellStyle}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.thresholds.map((t) => (
                      <tr key={t.threshold} style={t.threshold === r.threshold ? { fontWeight: 600 } : undefined}>
                        <td style={cellStyle}>{t.threshold.toFixed(2)}</td>
                        <td style={cellStyle}>
                          {t.found} из {r.found.total}
                        </td>
                        <td style={cellStyle}>{r.nothing.total ? `${t.nothing} из ${r.nothing.total}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </AdminPage>
  )
}
