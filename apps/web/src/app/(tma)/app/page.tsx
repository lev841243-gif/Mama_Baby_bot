import { ClientEntry } from './ClientEntry'

// Страница-вход мини-приложения не кешируется: Telegram держал утреннюю версию, а она ссылалась на скрипты
// прошлой сборки, которых после деплоя уже нет, — приложение не открывалось. Сама страница лёгкая,
// скрипты (`/_next/static`, с хешем в имени) по-прежнему кешируются надолго.
export const dynamic = 'force-dynamic'

export default function Page() {
  return <ClientEntry />
}
