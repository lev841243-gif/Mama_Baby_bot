import type { AdminViewServerProps } from 'payload'
import { AdminPage } from './AdminPage'
import { ImportDocxForm } from './ImportDocxForm'

/** «Загрузить из .docx» (ТЗ 9.2, 9.4): документ по шаблону → черновик для проверки. */
export async function ImportDocxView(props: AdminViewServerProps) {
  return (
    <AdminPage props={props} title="Загрузить материал из .docx">
      <div style={{ maxWidth: 720 }}>
        <p>
          Заполните <a href="/admin-files/shablon-uprazhneniya.docx">шаблон упражнения</a> в Яндекс Документах, скачайте его как
          .docx («Файл → Скачать как → Документ Word») и загрузите сюда. Получится черновик: проверьте его, добавьте недостающее
          и опубликуйте. Как заполнять — в <a href="/pamyatka" target="_blank">памятке</a>.
        </p>
        <ImportDocxForm />
      </div>
    </AdminPage>
  )
}
