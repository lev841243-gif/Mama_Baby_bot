import 'server-only'
import { randomUUID } from 'node:crypto'
import { type AppSettings, type SubscriptionPlan, hashTgId, processPayment } from '@mama/shared'
import { getBotQueue, getDb, log } from './server'

// Способы оплаты подписки (ТЗ 8.6). TODO(Р21): способ выбирают заказчица и юрист по правилам Telegram.
// Пока работает тестовый провайдер — только во время тестирования (ТЗ 14: оплата только в тестовом режиме).
// Telegram Stars подготовлен и включается PAYMENT_PROVIDER=stars после решения.

export type PaymentStart = { kind: 'done'; endsAt: string } | { kind: 'invoice'; link: string }

export interface PaymentProvider {
  id: 'test' | 'stars'
  start(tgId: number, plan: SubscriptionPlan): Promise<PaymentStart>
}

/** Подтверждённая оплата → сообщение в чат. Сбой очереди не ломает оплату: доступ уже открыт. */
export async function notifyPaid(tgId: number, endsAt: Date) {
  await getBotQueue()
    .add('subscription-paid', { tgId, endsAt: endsAt.toISOString() }, { removeOnComplete: true, removeOnFail: 100 })
    .catch((err: unknown) => log.error({ err, user: hashTgId(tgId) }, 'enqueue subscription-paid failed'))
}

/** Тестовая оплата: без денег, подтверждается сразу. Проходит тот же идемпотентный путь, что и настоящая. */
const testProvider: PaymentProvider = {
  id: 'test',
  async start(tgId, plan) {
    const res = await processPayment(getDb(), {
      provider: 'test',
      providerPaymentId: `test-${randomUUID()}`,
      tgId,
      plan,
      amount: plan.priceRub * 100,
      currency: 'RUB',
    })
    if (!res.endsAt) throw new Error(`test payment not applied: ${res.status}`)
    await notifyPaid(tgId, res.endsAt)
    return { kind: 'done', endsAt: res.endsAt.toISOString() }
  },
}

/**
 * Telegram Stars: счёт через Bot API, подтверждение приходит боту (pre_checkout_query → successful_payment),
 * там же processPayment. Платёжные данные проект не получает (ТЗ 8.6).
 */
const starsProvider: PaymentProvider = {
  id: 'stars',
  async start(_tgId, plan) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `Подписка на ${plan.title}`,
        description: 'Доступ к закрытым материалам автора',
        payload: `sub:${plan.id}`,
        currency: 'XTR',
        prices: [{ label: plan.title, amount: plan.priceStars }],
      }),
    })
    const json = (await res.json()) as { ok: boolean; result?: string }
    if (!json.ok || !json.result) throw new Error('createInvoiceLink failed')
    return { kind: 'invoice', link: json.result }
  },
}

export function activeProvider(settings: AppSettings): PaymentProvider | null {
  const name = process.env.PAYMENT_PROVIDER ?? 'test'
  if (name === 'stars') return starsProvider
  if (name === 'test' && settings.testerPhase) return testProvider
  return null
}
