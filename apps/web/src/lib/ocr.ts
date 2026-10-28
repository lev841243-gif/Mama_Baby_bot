// Распознавание текста каруселей (ТЗ 9.9, шаг 2): Yandex Vision OCR.
// TODO(Р4): сервис и договор утверждает заказчица; без ключа возвращаем null — блок помечается
// «требует проверки», и автор вставляет исходный текст сама.

export async function recognizeText(image: Buffer, mimeType: string): Promise<string | null> {
  const key = process.env.YANDEX_VISION_API_KEY
  const folder = process.env.YANDEX_FOLDER_ID
  if (!key || !folder) return null
  const res = await fetch('https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText', {
    method: 'POST',
    headers: { authorization: `Api-Key ${key}`, 'x-folder-id': folder, 'content-type': 'application/json' },
    body: JSON.stringify({ mimeType: mimeType.toUpperCase().includes('PNG') ? 'PNG' : 'JPEG', languageCodes: ['ru'], model: 'page', content: image.toString('base64') }),
  }).catch(() => null)
  if (!res?.ok) return null
  const json = (await res.json().catch(() => null)) as { result?: { textAnnotation?: { fullText?: string } } } | null
  return json?.result?.textAnnotation?.fullText?.trim() || null
}
