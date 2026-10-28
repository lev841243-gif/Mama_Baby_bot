'use client'
import { formatDay } from '@mama/shared/calendar-parse'
import { MONTHS_RU } from '@mama/shared/texts'
import { openLink } from '@telegram-apps/sdk-react'
import { Button, Cell, List, Section } from '@telegram-apps/telegram-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CalendarEntryOut, CalendarPayload } from '@/lib/tma-types'
import { AgeSection } from '../AgePicker'
import { api } from '../api'
import { Confirm } from '../Confirm'
import { useApp } from '../nav'
import { haptic } from '../telegram'
import { Loading, Message } from '../ui'

type Entry = Omit<CalendarEntryOut, 'id'>
type Action =
  | { action: 'enable' }
  | { action: 'add'; entry: Entry }
  | { action: 'update'; id: number; entry: Entry }
  | { action: 'delete'; id: number }
  | { action: 'clear' }
  | { action: 'disable' }

const danger = { color: 'var(--tg-theme-destructive-text-color, #e53935)' }

/**
 * Календарь навыков (ТЗ 8.1 п. 8, 10.4): личный дневник мамы — записи «навык — дата — статус» и график.
 * Без норм, сроков, сравнений и слов «отставание», «рано/поздно» (правило 3.4, приёмка 23).
 */
export function CalendarScreen() {
  const { initData, session } = useApp()
  const t = session.texts
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ id: number | null; entry: Partial<Entry> } | null>(null)
  const [confirm, setConfirm] = useState<'clear' | 'disable' | { delete: number } | null>(null)
  const cal = useQuery({ queryKey: ['calendar'], queryFn: () => api<CalendarPayload>('/api/tma/calendar', initData, null) })
  const act = useMutation({
    mutationFn: (a: Action) => api<CalendarPayload>('/api/tma/calendar', initData, a),
    onSuccess: (next, a) => {
      qc.setQueryData(['calendar'], next)
      if (next.result === 'ok' || a.action !== 'add') haptic((h) => h.notificationOccurred.ifAvailable('success'))
      if (next.result === 'ok') setEditing(null)
      setConfirm(null)
      if (a.action === 'enable' || a.action === 'disable') void qc.invalidateQueries({ queryKey: ['session'] })
    },
  })

  if (cal.isPending) return <Loading />
  if (cal.error) return <Message text={t.loadError} />
  const c = cal.data
  if (!c.enabled) return <Message text={t.notReadyYet} />
  const header = <h1 className="px-4 pt-2 text-xl font-semibold">{t.calTitle}</h1>

  // Без согласия — предложение (шаблон 07 §6). Календарь включается только отдельным согласием (приёмка 24).
  if (!c.consent) {
    const openDoc = () => {
      const url = new URL('/calendar-consent', window.location.origin).toString()
      try {
        openLink(url)
      } catch {
        window.open(url, '_blank')
      }
    }
    return (
      <List>
        {header}
        <p className="whitespace-pre-line px-4 text-[15px] leading-snug">{t.calOffer}</p>
        <div className="px-4">
          <button type="button" className="text-sm underline" style={{ color: 'var(--app-link)' }} onClick={openDoc}>
            {t.calConsentLink}
          </button>
        </div>
        <div className="px-4 pt-2">
          <Button size="l" stretched loading={act.isPending} onClick={() => act.mutate({ action: 'enable' })}>
            {t.calEnable}
          </Button>
        </div>
      </List>
    )
  }

  // Дата рождения спрашивается при включении календаря (ТЗ 6.3).
  if (!c.birth) {
    return (
      <List>
        {header}
        <AgeSection header={t.calAskAge} footer="" />
      </List>
    )
  }

  const skillName = (id: number) => c.skills.find((s) => s.id === id)?.name ?? '—'
  const statusName = (s: Entry['status']) => (s === 'start' ? t.calStatusStart : t.calStatusFormed)
  const minDay = `${c.birth.year}-${String(c.birth.month).padStart(2, '0')}-01`

  return (
    <List>
      {header}
      <p className="px-4 text-[15px] leading-snug opacity-80">{t.calIntro}</p>

      {c.entries.length > 0 && (
        <Section header={t.calTimeline}>
          <Timeline entries={c.entries} skillName={skillName} today={c.today} legend={`○ ${t.calStatusStart} · ● ${t.calStatusFormed}`} />
        </Section>
      )}

      {editing ? (
        <EntryForm
          key={editing.id ?? 'new'}
          initial={editing.entry}
          skills={c.skills}
          min={minDay}
          max={c.today}
          busy={act.isPending}
          error={act.data?.result === 'bad_day' ? t.calAskDate : null}
          onSave={(entry) => act.mutate(editing.id ? { action: 'update', id: editing.id, entry } : { action: 'add', entry })}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="px-4 pt-2">
          <Button size="l" stretched onClick={() => setEditing({ id: null, entry: { day: c.today } })}>
            {t.calAddButton}
          </Button>
        </div>
      )}

      <Section header={t.calList}>
        {c.entries.length === 0 && <Cell multiline>{t.calEmpty}</Cell>}
        {[...c.entries].reverse().map((e) => (
          <Cell
            key={e.id}
            multiline
            subtitle={`${formatDay(e.day, true)} · ${statusName(e.status)}`}
            after={
              <span className="flex gap-3 text-[14px]">
                <button type="button" style={{ color: 'var(--app-link)' }} onClick={() => setEditing({ id: e.id, entry: e })}>
                  {t.calEditRecord}
                </button>
                <button type="button" style={danger} onClick={() => setConfirm({ delete: e.id })}>
                  ✕
                </button>
              </span>
            }
          >
            {skillName(e.skillId)}
          </Cell>
        ))}
      </Section>

      <Section>
        {c.entries.length > 0 && (
          <Cell onClick={() => setConfirm('clear')} style={danger}>
            {t.calDeleteAll}
          </Cell>
        )}
        <Cell onClick={() => setConfirm('disable')} style={danger}>
          {t.calOff}
        </Cell>
      </Section>

      {confirm && (
        <Confirm
          text={confirm === 'clear' ? t.calDeleteAllConfirm : confirm === 'disable' ? t.calOffConfirm : t.calDeleteRecordConfirm}
          okText={confirm === 'clear' ? t.calDeleteAllOk : confirm === 'disable' ? t.calOffOk : t.calDeleteRecord}
          cancelText={t.revokeNo}
          loading={act.isPending}
          onOk={() =>
            act.mutate(confirm === 'clear' ? { action: 'clear' } : confirm === 'disable' ? { action: 'disable' } : { action: 'delete', id: confirm.delete })
          }
          onCancel={() => setConfirm(null)}
        />
      )}
      {act.isError && <p className="px-4 text-sm text-red-600">{t.loadError}</p>}
    </List>
  )
}

/** Запись кнопками, без голоса (ТЗ 10.4): навык, статус, дата (не в будущем и не раньше рождения). */
function EntryForm(props: {
  initial: Partial<Entry>
  skills: { id: number; name: string }[]
  min: string
  max: string
  busy: boolean
  error: string | null
  onSave: (e: Entry) => void
  onCancel: () => void
}) {
  const { session } = useApp()
  const t = session.texts
  const [e, setE] = useState<Partial<Entry>>(props.initial)
  const ready = e.skillId && e.status && e.day && e.day >= props.min && e.day <= props.max
  const field = { background: 'var(--app-secondary-bg)', color: 'inherit' }
  return (
    <Section>
      <div className="flex flex-col gap-3 px-4 py-3">
        <label className="flex flex-col gap-1 text-[14px]">
          {t.calAskSkill}
          <select
            className="rounded-lg p-2 text-[15px]"
            style={field}
            value={e.skillId ?? ''}
            onChange={(x) => setE({ ...e, skillId: Number(x.target.value) || undefined })}
          >
            <option value="" />
            {props.skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-[14px]">
          {t.calAskStatus}
          <div className="flex gap-2">
            {(['start', 'formed'] as const).map((s) => (
              <Button key={s} size="s" mode={e.status === s ? 'filled' : 'bezeled'} onClick={() => setE({ ...e, status: s })}>
                {s === 'start' ? t.calStatusStart : t.calStatusFormed}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[14px]">
          {t.calAskDate}
          <input
            type="date"
            className="rounded-lg p-2 text-[15px]"
            style={field}
            min={props.min}
            max={props.max}
            value={e.day ?? ''}
            onChange={(x) => setE({ ...e, day: x.target.value || undefined })}
          />
        </label>
        {props.error && <p className="text-sm text-red-600">{props.error}</p>}
        <div className="flex gap-2">
          <Button size="m" stretched disabled={!ready} loading={props.busy} onClick={() => ready && props.onSave(e as Entry)}>
            {t.calSaveButton}
          </Button>
          <Button size="m" mode="bezeled" stretched disabled={props.busy} onClick={props.onCancel}>
            {t.calCancel}
          </Button>
        </div>
      </div>
    </Section>
  )
}

const dayNum = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000

/**
 * График (ТЗ 10.4): по навыку — линия от «старта» до «сформирован», точки — записи мамы. Ось — только даты.
 * Ни норм, ни средних сроков, ни отметок возраста: только записи самой мамы (правило 3.4, приёмка 23).
 */
function Timeline({ entries, skillName, today, legend }: { entries: CalendarEntryOut[]; skillName: (id: number) => string; today: string; legend: string }) {
  const bySkill = new Map<number, CalendarEntryOut[]>()
  for (const e of entries) bySkill.set(e.skillId, [...(bySkill.get(e.skillId) ?? []), e])
  const from = Math.min(...entries.map((e) => dayNum(e.day)))
  const to = Math.max(dayNum(today), from + 30)
  const W = 340
  const LABEL = 110
  const ROW = 30
  const x = (d: string) => LABEL + ((dayNum(d) - from) / (to - from)) * (W - LABEL - 12)
  const rows = [...bySkill.entries()]
  const H = rows.length * ROW + 24
  // Подписи месяцев на оси: первое число каждого месяца в диапазоне, не чаще чем через ~50 px.
  const ticks: { d: string; label: string }[] = []
  const start = new Date(from * 86_400_000)
  for (let m = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); m.getTime() / 86_400_000 <= to; m.setUTCMonth(m.getUTCMonth() + 1)) {
    const d = m.toISOString().slice(0, 10)
    if (!ticks.length || x(d) - x(ticks[ticks.length - 1]!.d) > 50) ticks.push({ d, label: MONTHS_RU[m.getUTCMonth()]!.slice(0, 3) })
  }
  return (
    <div className="px-2 py-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-hidden="true">
        {ticks.map((tk) => (
          <g key={tk.d}>
            <line x1={x(tk.d)} x2={x(tk.d)} y1={0} y2={H - 18} stroke="currentColor" strokeOpacity={0.12} />
            <text x={x(tk.d)} y={H - 4} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
              {tk.label}
            </text>
          </g>
        ))}
        {rows.map(([skillId, list], i) => {
          const y = i * ROW + 14
          const days = list.map((e) => e.day).sort()
          const startDay = list.filter((e) => e.status === 'start').map((e) => e.day).sort()[0] ?? days[0]!
          const formedDay = list.filter((e) => e.status === 'formed').map((e) => e.day).sort()[0]
          return (
            <g key={skillId}>
              <text x={0} y={y + 4} fontSize={11} fill="currentColor">
                {skillName(skillId).length > 17 ? `${skillName(skillId).slice(0, 16)}…` : skillName(skillId)}
              </text>
              {formedDay && formedDay > startDay && (
                <line x1={x(startDay)} x2={x(formedDay)} y1={y} y2={y} stroke="var(--tg-theme-button-color, #2481cc)" strokeWidth={4} strokeLinecap="round" />
              )}
              {list.map((e) => (
                <circle
                  key={e.id}
                  cx={x(e.day)}
                  cy={y}
                  r={5}
                  fill={e.status === 'formed' ? 'var(--tg-theme-button-color, #2481cc)' : 'var(--tg-theme-bg-color, #fff)'}
                  stroke="var(--tg-theme-button-color, #2481cc)"
                  strokeWidth={2}
                >
                  <title>{formatDay(e.day, true)}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <p className="px-2 text-[12px] opacity-60">{legend}</p>
    </div>
  )
}
