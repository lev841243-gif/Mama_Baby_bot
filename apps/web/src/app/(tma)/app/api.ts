export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Запрос к API мини-приложения с подписанными данными запуска Telegram. */
export async function api<T>(path: string, initData: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { authorization: `tma ${initData}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, typeof json.text === 'string' ? json.text : `HTTP ${res.status}`)
  return json as T
}
