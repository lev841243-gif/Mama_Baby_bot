import Link from 'next/link'

const LINKS = [
  { href: '/admin/import-docx', label: 'Загрузить из .docx' },
  { href: '/admin/summary', label: 'Сводка' },
  { href: '/admin/access-list', label: 'Список доступа' },
  { href: '/admin/testers', label: 'Тестировщики' },
]

/** Свои экраны админки в меню (ТЗ 11.3, 14). */
export function NavLinks() {
  return (
    <div style={{ marginTop: 16 }}>
      <p className="nav-group__toggle" style={{ opacity: 0.6, margin: '0 0 6px' }}>
        Проект
      </p>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="nav__link" style={{ display: 'block', padding: '4px 0' }}>
          {l.label}
        </Link>
      ))}
    </div>
  )
}
