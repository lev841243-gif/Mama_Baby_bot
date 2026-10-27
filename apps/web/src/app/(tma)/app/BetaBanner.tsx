/** Плашка бета-версии вверху каждого экрана (ТЗ 14, шаблон 07 §0). */
export function BetaBanner({ text }: { text: string }) {
  return (
    <div
      role="note"
      className="px-4 py-2 text-[13px] leading-snug"
      style={{
        background: 'var(--tg-theme-secondary-bg-color, #fff4d6)',
        color: 'var(--tg-theme-hint-color, #6b5a2b)',
      }}
    >
      {text}
    </div>
  )
}
