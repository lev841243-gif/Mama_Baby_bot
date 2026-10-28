import { T, type BotJob } from '@mama/shared'
import { type Api, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'

export type AnnounceData = Extract<BotJob, { name: 'test-announce' }>['data']

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

/**
 * Анонс: картинка, название, 2–3 строки, кнопка «Открыть в приложении» (ТЗ 7).
 * На этапе 1 — только тестовая отправка автору себе (ТЗ 9.4); лента — этап 2.
 */
export async function sendAnnounce(api: Api, log: Logger, publicUrl: string, d: AnnounceData) {
  const text = `<b>${escapeHtml(d.title)}</b>${d.announce ? `\n\n${escapeHtml(d.announce)}` : ''}`
  const reply_markup = new InlineKeyboard().webApp(T.openAppButton, `${publicUrl}/app?m=${d.materialId}`)
  if (d.photoUrl) {
    try {
      await api.sendPhoto(d.tgId, d.photoUrl, { caption: text, parse_mode: 'HTML', reply_markup })
      return
    } catch (err) {
      // Telegram не смог скачать картинку (например, адрес не публичный) — шлём без неё.
      log.warn({ err }, 'announce photo failed, sending text')
    }
  }
  await api.sendMessage(d.tgId, text, { parse_mode: 'HTML', reply_markup, link_preview_options: { is_disabled: true } })
}
