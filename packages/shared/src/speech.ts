// Распознавание речи для календаря навыков (ТЗ 10.2, 10.4). Только сервисы в РФ с отключённым
// сохранением данных и без обучения на них (ТЗ 3.6, 3.7). Аудио приходит в память и не пишется
// ни на диск, ни в Redis, ни в логи; поэтому вызов идёт прямо из бота, а не через очередь `ai`.
// TODO(Р4): SpeechKit или SaluteSpeech — после решения заказчицы и договора; пока фейковый провайдер.

export interface SpeechProvider {
  readonly id: string
  /** Голосовое Telegram (OGG/Opus) → текст. Аудио после вызова не хранится. */
  transcribe(audio: Buffer, mimeType: string): Promise<string>
}

/** Ограничение длины голосового (ТЗ 10.2). */
export const VOICE_MAX_SECONDS = 60
/** Распознавание ≤ 10 с (ТЗ 13); дольше — просим повторить или выбрать кнопками. */
export const VOICE_TIMEOUT_MS = 10_000

/** Без сервиса: фиксированная фраза (для проверки всего пути без внешних вызовов). */
export const fakeSpeechProvider: SpeechProvider = {
  id: 'fake',
  async transcribe() {
    return process.env.FAKE_SPEECH_TEXT ?? 'Сегодня пополз, но пока неуверенно'
  },
}

/** Провайдер по env. Claude и любые зарубежные сервисы сюда не подключаются: это голос мам. */
export function speechProvider(): SpeechProvider {
  // TODO(Р4): SPEECH_PROVIDER=speechkit | salute.
  return fakeSpeechProvider
}

export async function transcribeWithTimeout(p: SpeechProvider, audio: Buffer, mimeType: string, ms = VOICE_TIMEOUT_MS): Promise<string> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      p.transcribe(audio, mimeType),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('speech timeout')), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
