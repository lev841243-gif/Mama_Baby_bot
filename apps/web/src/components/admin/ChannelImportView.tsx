import type { AdminViewServerProps } from 'payload'
import { AdminPage, cellStyle, tableStyle } from './AdminPage'
import { ChannelImportForm } from './ChannelImportForm'

const STATUSES = [
  { value: 'inbox', label: 'Входящие из канала (новые посты)' },
  { value: 'blocks', label: 'Нарезаны на блоки, ждут сборки' },
  { value: 'used', label: 'Собраны в статьи' },
  { value: 'skipped', label: 'Пропущены (с причиной)' },
]

/** Перенос постов канала (ТЗ 9.9): выгрузка → блоки и «пропущено» → черновики статей. */
export async function ChannelImportView(props: AdminViewServerProps) {
  const { payload } = props.initPageResult.req
  const counts = await Promise.all(
    STATUSES.map(async (s) => ({
      ...s,
      n: (await payload.count({ collection: 'channel-posts', where: { status: { equals: s.value } }, overrideAccess: true })).totalDocs,
    })),
  )
  const review = (await payload.count({ collection: 'channel-posts', where: { needsReview: { equals: true } }, overrideAccess: true })).totalDocs
  const edited = (await payload.count({ collection: 'channel-posts', where: { edited: { equals: true } }, overrideAccess: true })).totalDocs
  const freeBlocks = (await payload.count({ collection: 'channel-blocks', where: { used: { not_equals: true } }, overrideAccess: true })).totalDocs
  const list = (status: string) => `/admin/collections/channel-posts?where[status][equals]=${status}`

  return (
    <AdminPage props={props} title="Посты канала">
      <div style={{ maxWidth: 760 }}>
        <p>
          1. В Telegram Desktop: канал → ⋮ → «Экспорт истории чата», формат <b>JSON</b>, с фотографиями. Заархивируйте папку в .zip
          (или загрузите только result.json — тогда без картинок).
        </p>
        <p>2. Загрузите сюда. Каждый пост попадёт либо в блоки, либо в «пропущено» с причиной. Повторная загрузка ничего не дублирует.</p>
        <ChannelImportForm freeBlocks={freeBlocks} />
        <p style={{ marginTop: 24 }}>
          3. «Предложить статьи» — ИИ группирует блоки в черновики статей. Он не пишет своего текста: всё, чего нет в постах, подсвечено в
          карточке статьи. Публикуете вы.
        </p>
        <table style={{ ...tableStyle, marginTop: 16 }}>
          <tbody>
            {counts.map((c) => (
              <tr key={c.value}>
                <td style={cellStyle}>
                  <a href={list(c.value)}>{c.label}</a>
                </td>
                <td style={cellStyle}>{c.n}</td>
              </tr>
            ))}
            <tr>
              <td style={cellStyle}>
                <a href="/admin/collections/channel-posts?where[needsReview][equals]=true">Требуют проверки (карусели)</a>
              </td>
              <td style={cellStyle}>{review}</td>
            </tr>
            <tr>
              <td style={cellStyle}>
                <a href="/admin/collections/channel-posts?where[edited][equals]=true">Пост изменён в канале</a>
              </td>
              <td style={cellStyle}>{edited}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminPage>
  )
}
