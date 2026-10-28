// Календарь навыков в боте (ТЗ 6.2, 6.4, 10.2, 10.4): голосом или кнопками → «Записала: …» → «Верно».
// Без «Верно» ничего не сохраняется. Черновик записи живёт только в кнопках (callback_data), не на сервере.
// Голос: в память → распознавание → сразу забываем; ни аудио, ни текста нет в базе, Redis и логах (приёмка 22).
import {
  MONTHS_RU,
  T,
  addCalendarEntry,
  calendarAccess,
  clearCalendar,
  enableCalendar,
  findRedWord,
  fmt,
  formatDay,
  getChildBirth,
  getRedWords,
  hashTgId,
  isValidCalendarDay,
  listSkills,
  materialsForSkill,
  parseCalendarText,
  todayFor,
  transcribeWithTimeout,
  VOICE_MAX_SECONDS,
  type CalendarDraft,
  type CalendarStatus,
  type SpeechProvider,
} from '@mama/shared'
import type { Db } from '@mama/shared/db'
import { InlineKeyboard, type Bot, type Context } from 'grammy'
import type { Logger } from 'pino'
import { appLink } from './app-url'

type Helpers = {
  db: Db
  log: Logger
  publicUrl: string
  show: (ctx: Context, text: string, keyboard: InlineKeyboard, parseHtml?: boolean) => Promise<void>
  mainMenu: () => InlineKeyboard
  ageYearKeyboard: (next: 'calendar') => Promise<InlineKeyboard>
  speech: SpeechProvider
  /** Голосовое из Telegram — в память, без записи на диск. */
  downloadFile: (fileId: string) => Promise<Buffer>
}

const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } }
const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

/** Черновик в callback_data: «навык:статус:день», «-» — не выбрано. 64 байта Telegram хватает. */
export function encodeDraft(d: CalendarDraft): string {
  return [d.skillId ?? '-', d.status ? d.status[0] : '-', d.day ? d.day.replace(/-/g, '') : '-'].join(':')
}

export function decodeDraft(s: string): CalendarDraft {
  const [sk, st, day] = s.split(':')
  return {
    skillId: sk && sk !== '-' ? Number(sk) : undefined,
    status: st === 's' ? 'start' : st === 'f' ? 'formed' : undefined,
    day: day && /^\d{8}$/.test(day) ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : undefined,
  }
}

const DRAFT = '([0-9-]+:[sf-]:(?:\\d{8}|-))'
const statusLabel = (s: CalendarStatus) => (s === 'start' ? T.calStatusStart : T.calStatusFormed)

export function setupCalendarBot(bot: Bot, h: Helpers) {
  const { db, log, publicUrl, show, mainMenu } = h

  /** Следующий вопрос по черновику: навык → статус → дата → подтверждение (ТЗ 10.4, п. 3–4). */
  async function advance(ctx: Context, d: CalendarDraft, prefix = '') {
    const skills = await listSkills(db)
    if (!d.skillId || !skills.some((s) => s.id === d.skillId)) {
      const kb = new InlineKeyboard()
      skills.forEach((s, i) => {
        kb.text(s.name, `cal:v:${encodeDraft({ ...d, skillId: s.id })}`)
        if (i % 2 === 1) kb.row()
      })
      return show(ctx, prefix + T.calAskSkill, kb.row().text(T.calCancel, 'cal:no'), true)
    }
    if (!d.status) {
      const kb = new InlineKeyboard()
        .text(T.calStatusStart, `cal:v:${encodeDraft({ ...d, status: 'start' })}`)
        .text(T.calStatusFormed, `cal:v:${encodeDraft({ ...d, status: 'formed' })}`)
        .row()
        .text(T.calCancel, 'cal:no')
      return show(ctx, prefix + T.calAskStatus, kb, true)
    }
    const today = await todayFor(db, ctx.from!.id)
    const birth = await getChildBirth(db, ctx.from!.id)
    if (!d.day || !isValidCalendarDay(d.day, today, birth)) {
      const yesterday = new Date(`${today}T12:00:00Z`)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const kb = new InlineKeyboard()
        .text(T.calToday, `cal:v:${encodeDraft({ ...d, day: today })}`)
        .text(T.calYesterday, `cal:v:${encodeDraft({ ...d, day: yesterday.toISOString().slice(0, 10) })}`)
        .row()
        .text(T.calOtherDay, `cal:mm:${encodeDraft({ ...d, day: undefined })}`)
        .row()
        .text(T.calCancel, 'cal:no')
      return show(ctx, prefix + T.calAskDate, kb, true)
    }
    const skill = skills.find((s) => s.id === d.skillId)!
    const text = fmt(T.calConfirm, { date: formatDay(d.day), skill: skill.name.toLowerCase(), status: statusLabel(d.status) })
    const kb = new InlineKeyboard()
      .text(T.calOk, `cal:ok:${encodeDraft(d)}`)
      .text(T.calFix, `cal:fx:${encodeDraft(d)}`)
      .text(T.calCancel, 'cal:no')
    await show(ctx, prefix + escapeHtml(text), kb, true)
  }

  /** «Записать навык»: календарь выключен в проекте — «в разработке»; нет согласия — предложение (07 §6). */
  async function start(ctx: Context) {
    const access = await calendarAccess(db, ctx.from!.id)
    if (access.status === 'off') return show(ctx, T.notReadyYet, mainMenu())
    if (access.status === 'need_consent') {
      const text = `${escapeHtml(T.calOffer)}\n\n<a href="${publicUrl}/calendar-consent">${escapeHtml(T.calConsentLink)}</a>`
      return show(ctx, text, new InlineKeyboard().text(T.calEnable, 'cal:on').text(T.calNotNow, 'cal:later'), true)
    }
    // Дата рождения спрашивается при включении календаря (ТЗ 6.3).
    if (!(await getChildBirth(db, ctx.from!.id))) return show(ctx, T.calAskAge, await h.ageYearKeyboard('calendar'))
    await show(ctx, T.calAskVoice, new InlineKeyboard().text(T.calPickButtons, 'cal:v:-:-:-').row().text(T.backButton, 'menu'))
  }

  bot.callbackQuery('cal', start)
  bot.callbackQuery('cal:on', async (ctx) => {
    if (await enableCalendar(db, ctx.from.id)) log.info({ user: hashTgId(ctx.from.id) }, 'calendar enabled (bot)')
    await start(ctx)
  })
  bot.callbackQuery('cal:later', (ctx) => show(ctx, T.calNotNowDone, mainMenu()))
  bot.callbackQuery('cal:no', (ctx) => show(ctx, T.calCancelled, mainMenu()))
  bot.callbackQuery('cal:restart', async (ctx) => {
    await clearCalendar(db, ctx.from.id)
    await show(ctx, T.calCleared, mainMenu())
  })

  bot.callbackQuery(new RegExp(`^cal:v:${DRAFT}$`), async (ctx) => {
    if ((await calendarAccess(db, ctx.from.id)).status !== 'ok') return start(ctx)
    await advance(ctx, decodeDraft(ctx.match![1]!))
  })

  bot.callbackQuery(new RegExp(`^cal:fx:${DRAFT}$`), async (ctx) => {
    const d = decodeDraft(ctx.match![1]!)
    const kb = new InlineKeyboard()
      .text(T.calFixSkill, `cal:v:${encodeDraft({ ...d, skillId: undefined })}`)
      .text(T.calFixStatus, `cal:v:${encodeDraft({ ...d, status: undefined })}`)
      .text(T.calFixDate, `cal:v:${encodeDraft({ ...d, day: undefined })}`)
      .row()
      .text(T.calCancel, 'cal:no')
    await show(ctx, T.calFixWhat, kb)
  })

  // «Другой день»: месяц (с месяца рождения, не больше 18 назад) → день.
  bot.callbackQuery(new RegExp(`^cal:mm:${DRAFT}$`), async (ctx) => {
    const d = decodeDraft(ctx.match![1]!)
    const today = await todayFor(db, ctx.from.id)
    const birth = await getChildBirth(db, ctx.from.id)
    const kb = new InlineKeyboard()
    let y = Number(today.slice(0, 4))
    let m = Number(today.slice(5, 7))
    for (let i = 0; i < 18; i++) {
      if (birth && (y < birth.year || (y === birth.year && m < birth.month))) break
      kb.text(`${MONTHS_RU[m - 1]} ${y}`, `cal:m:${encodeDraft(d)}:${y}${String(m).padStart(2, '0')}`)
      if (i % 3 === 2) kb.row()
      if (--m === 0) {
        m = 12
        y--
      }
    }
    await show(ctx, T.calAskMonth, kb.row().text(T.calCancel, 'cal:no'))
  })
  bot.callbackQuery(new RegExp(`^cal:m:${DRAFT}:(\\d{6})$`), async (ctx) => {
    const d = decodeDraft(ctx.match![1]!)
    const ym = ctx.match![2]!
    const today = await todayFor(db, ctx.from.id)
    const birth = await getChildBirth(db, ctx.from.id)
    const kb = new InlineKeyboard()
    let n = 0
    for (let day = 1; day <= 31; day++) {
      const key = `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, '0')}`
      if (!isValidCalendarDay(key, today, birth)) continue
      kb.text(String(day), `cal:v:${encodeDraft({ ...d, day: key })}`)
      if (++n % 7 === 0) kb.row()
    }
    await show(ctx, T.calAskDay, kb.row().text(T.calCancel, 'cal:no'))
  })

  // «Верно» — единственное место, где запись сохраняется (приёмка 21).
  bot.callbackQuery(new RegExp(`^cal:ok:${DRAFT}$`), async (ctx) => {
    const d = decodeDraft(ctx.match![1]!)
    if (!d.skillId || !d.status || !d.day) return advance(ctx, d)
    const tgId = ctx.from.id
    const res = await addCalendarEntry(db, tgId, { skillId: d.skillId, status: d.status, day: d.day }, await todayFor(db, tgId))
    if (res === 'off' || res === 'need_consent') return start(ctx)
    if (res !== 'ok') return advance(ctx, res === 'bad_day' ? { ...d, day: undefined } : { ...d, skillId: undefined })
    log.info({ user: hashTgId(tgId) }, 'calendar entry saved (bot)')
    // После записи — материалы автора по навыку (ТЗ 10.4, п. 5). Закрытые — с замком.
    const mats = await materialsForSkill(db, d.skillId)
    const kb = new InlineKeyboard()
    for (const m of mats) kb.webApp(`${m.access === 'paid' ? '🔒 ' : ''}${m.title}`, appLink(publicUrl, { m: m.id })).row()
    kb.webApp(T.calOpenApp, appLink(publicUrl, { screen: 'calendar' }))
    await show(ctx, mats.length ? `${T.calSaved}\n\n${T.calMaterials}` : T.calSaved, kb)
  })

  /** Голосовое (ТЗ 6.4, 10.2): только для календаря (решение Льва, Л2). */
  bot.on('message:voice', async (ctx) => {
    const tgId = ctx.from.id
    const access = await calendarAccess(db, tgId)
    if (access.status === 'off') return void (await ctx.reply(T.voiceNotSupported, { reply_markup: mainMenu() }))
    // Без согласия на календарь аудио никуда не отправляем.
    if (access.status === 'need_consent') return start(ctx)
    if (ctx.message.voice.duration > VOICE_MAX_SECONDS) return void (await ctx.reply(T.voiceTooLong))

    const started = Date.now()
    let text: string
    try {
      let audio: Buffer | null = await h.downloadFile(ctx.message.voice.file_id)
      text = await transcribeWithTimeout(h.speech, audio, ctx.message.voice.mime_type ?? 'audio/ogg')
      audio = null
    } catch (err) {
      log.warn({ err: String(err).slice(0, 100), user: hashTgId(tgId), provider: h.speech.id }, 'voice not recognized')
      return void (await ctx.reply(T.voiceFailed, { reply_markup: new InlineKeyboard().text(T.calPickButtons, 'cal:v:-:-:-') }))
    }
    // Ни текста, ни file_id в логах — только время распознавания.
    log.info({ user: hashTgId(tgId), provider: h.speech.id, ms: Date.now() - started }, 'voice recognized')

    // «Красные слова» — до любого действия: экстренный текст вместо записи (ТЗ 10.3, приёмка 25).
    const { words, emergencyText } = await getRedWords(db)
    if (findRedWord(text, words)) {
      log.info('red word matched (voice)')
      return void (await ctx.reply(emergencyText, html))
    }
    const draft = parseCalendarText(text, await listSkills(db), await todayFor(db, tgId))
    // Распознанный текст всегда показывается маме перед действием (ТЗ 10.2).
    await advance(ctx, draft, `${escapeHtml(fmt(T.calHeard, { text }))}\n\n`)
  })

  return { start }
}
