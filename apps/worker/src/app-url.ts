// Адрес мини-приложения с версией. Telegram на iPhone кеширует страницу по адресу и после деплоя открывал
// старую страницу, чьих скриптов на сервере уже нет (вечная заглушка загрузки). Версия меняется при каждом
// запуске бота, то есть при каждом деплое: кнопка меню и новые кнопки ведут на новый адрес.
const VERSION = process.env.APP_URL_VERSION || Date.now().toString(36)

export function appLink(publicUrl: string, params: Record<string, string | number> = {}): string {
  const q = new URLSearchParams({ v: VERSION })
  for (const [k, v] of Object.entries(params)) q.set(k, String(v))
  return `${publicUrl}/app?${q}`
}
