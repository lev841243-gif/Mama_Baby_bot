'use client'
import { Button } from '@telegram-apps/telegram-ui'
import { useEffect, useRef, useState } from 'react'
import { haptic } from './telegram'

type Props = {
  src: string
  materialId: number
  t: Record<string, string>
  /** Первое воспроизведение — обезличенный счётчик прослушиваний. */
  onListen?: () => void
  /** «Прислать в чат»; нет — кнопки нет (предпросмотр). */
  onSend?: () => Promise<boolean>
}

const SPEEDS = [1, 1.25] as const
const posKey = (id: number) => `mama:audio-pos:${id}`

const clock = (s: number) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function readPos(id: number): number {
  try {
    return Number(localStorage.getItem(posKey(id))) || 0
  } catch {
    return 0
  }
}

function writePos(id: number, s: number | null) {
  try {
    if (s === null || s < 3) localStorage.removeItem(posKey(id))
    else localStorage.setItem(posKey(id), String(Math.floor(s)))
  } catch {
    /* приватный режим — без продолжения */
  }
}

/**
 * Аудиоплеер (ТЗ 8.4): поток (Range), пауза, перемотка, скорость 1× / 1,25×, продолжение с места.
 * Место остановки хранится только на этом устройстве (localStorage), не на сервере.
 */
export function AudioPlayer({ src, materialId, t, onListen, onSend }: Props) {
  const ref = useRef<HTMLAudioElement>(null)
  const listened = useRef(false)
  const lastSaved = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [sendState, setSendState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const a = ref.current
    if (!a) return
    const onMeta = () => {
      setDuration(a.duration)
      const saved = readPos(materialId)
      if (saved && saved < a.duration - 5) {
        a.currentTime = saved
        setTime(saved)
      }
    }
    const onTime = () => {
      setTime(a.currentTime)
      if (Math.abs(a.currentTime - lastSaved.current) >= 5) {
        lastSaved.current = a.currentTime
        writePos(materialId, a.currentTime)
      }
    }
    const onPause = () => {
      setPlaying(false)
      writePos(materialId, a.currentTime)
    }
    const onPlay = () => {
      setPlaying(true)
      if (!listened.current) {
        listened.current = true
        onListen?.()
      }
    }
    const onEnded = () => {
      setPlaying(false)
      writePos(materialId, null)
    }
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('pause', onPause)
    a.addEventListener('play', onPlay)
    a.addEventListener('ended', onEnded)
    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('ended', onEnded)
    }
  }, [materialId, onListen])

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed
  }, [speed])

  const toggle = () => {
    const a = ref.current
    if (!a) return
    haptic((h) => h.impactOccurred('light'))
    if (a.paused) void a.play()
    else a.pause()
  }

  const send = async () => {
    if (!onSend) return
    setSendState('busy')
    const ok = await onSend().catch(() => false)
    setSendState(ok ? 'sent' : 'error')
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl p-3" style={{ background: 'var(--app-secondary-bg)' }}>
      <audio ref={ref} src={src} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Пауза' : 'Слушать'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl"
          style={{ background: 'var(--tg-theme-button-color, #2481cc)', color: 'var(--tg-theme-button-text-color, #fff)' }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const a = ref.current
              if (a) a.currentTime = Number(e.target.value)
            }}
            className="w-full"
            aria-label="Перемотка"
          />
          <div className="flex justify-between text-[13px] opacity-60">
            <span>{clock(time)}</span>
            <span>{clock(duration)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 1.25 : 1))}
          aria-label={t.audioSpeed}
          className="shrink-0 rounded-lg px-2 py-1 text-[14px] font-semibold"
          style={{ color: 'var(--app-link)' }}
        >
          {speed === 1 ? '1×' : '1,25×'}
        </button>
      </div>
      {onSend && (
        <div className="pt-2">
          <Button size="s" mode="plain" loading={sendState === 'busy'} disabled={sendState === 'sent'} onClick={send}>
            {t.audioSendToChat}
          </Button>
          {sendState === 'sent' && <p className="text-[13px] opacity-70">{t.audioSent}</p>}
          {sendState === 'error' && <p className="text-[13px] text-red-600">{t.audioSendError}</p>}
        </div>
      )}
    </div>
  )
}
