import { Button } from '@telegram-apps/telegram-ui'

type Props = {
  text: string
  note?: string
  okText: string
  cancelText: string
  loading?: boolean
  onOk: () => void
  onCancel: () => void
}

/** Подтверждение необратимого действия прямо на экране (отзыв согласия, удаление данных). */
export function Confirm({ text, note, okText, cancelText, loading, onOk, onCancel }: Props) {
  return (
    <div
      role="alertdialog"
      className="mx-4 my-3 rounded-xl p-4"
      style={{ background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)' }}
    >
      <p className="text-[15px] font-medium leading-snug">{text}</p>
      {note && <p className="mt-2 text-[14px] leading-snug opacity-80">{note}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="m" mode="filled" loading={loading} onClick={onOk} style={{ flex: 1 }}>
          {okText}
        </Button>
        <Button size="m" mode="bezeled" disabled={loading} onClick={onCancel} style={{ flex: 1 }}>
          {cancelText}
        </Button>
      </div>
    </div>
  )
}
