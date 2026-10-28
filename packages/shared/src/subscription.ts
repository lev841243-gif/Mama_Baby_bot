import { and, count, eq, gt, isNull, lte } from 'drizzle-orm'
import type { Db } from './db/client'
import { payments, subscriptions, users } from './db/schema'

// Подписка на закрытые материалы (ТЗ 8.6). Доступ определяется сроком: по окончании закрывается сам
// (приёмка 18). Каждый платёж обрабатывается ровно один раз (приёмка 17).

export type SubscriptionPlan = {
  id: string
  title: string
  periodDays: number
  priceRub: number
  /** Цена в Telegram Stars (если выбран этот способ, Р21). */
  priceStars: number
}

export type SubscriptionConfig = {
  /** Что входит — текст автора (Р22). */
  description: string
  plans: SubscriptionPlan[]
}

// TODO(Р22): что закрыто, цена и период решает заказчица; до решения — один тариф-заглушка.
export const DEFAULT_SUBSCRIPTION: SubscriptionConfig = {
  description: 'Закрытые упражнения, статьи и аудиопрактики автора.',
  plans: [{ id: 'month', title: '1 месяц', periodDays: 30, priceRub: 0, priceStars: 0 }],
}

export type PaymentInput = {
  provider: string
  providerPaymentId: string
  tgId: number
  plan: SubscriptionPlan
  amount: number
  currency: string
}

export type PaymentResult = { status: 'applied' | 'duplicate' | 'no_user'; endsAt: Date | null }

const DAY = 24 * 60 * 60 * 1000

/**
 * Обработка подтверждённой оплаты. Идемпотентно: повторный вызов с тем же providerPaymentId
 * не продлевает подписку второй раз и не теряет первую оплату. Всё — в одной транзакции.
 */
export async function processPayment(db: Db, p: PaymentInput, now = new Date()): Promise<PaymentResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.tgId, p.tgId)).limit(1)
    const inserted = await tx
      .insert(payments)
      .values({
        userId: user?.id ?? null,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: 'paid',
        plan: p.plan.id,
        periodDays: p.plan.periodDays,
      })
      .onConflictDoNothing({ target: payments.providerPaymentId })
      .returning({ id: payments.id })

    if (!user) return { status: 'no_user', endsAt: null }
    const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1)
    if (inserted.length === 0) return { status: 'duplicate', endsAt: current?.endsAt ?? null }

    // Продление сдвигает срок от конца текущей подписки, а не от сегодняшнего дня.
    const from = current && current.endsAt > now ? current.endsAt : now
    const endsAt = new Date(from.getTime() + p.plan.periodDays * DAY)
    await tx
      .insert(subscriptions)
      .values({ userId: user.id, plan: p.plan.id, startedAt: now, endsAt, lastPaymentId: p.providerPaymentId })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { plan: p.plan.id, endsAt, lastPaymentId: p.providerPaymentId, remindedAt: null, updatedAt: now },
      })
    return { status: 'applied', endsAt }
  })
}

export async function getSubscription(db: Db, tgId: number, now = new Date()) {
  const [row] = await db
    .select({ plan: subscriptions.plan, endsAt: subscriptions.endsAt })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(eq(users.tgId, tgId))
    .limit(1)
  return row ? { ...row, active: row.endsAt > now } : null
}

/** Действующая подписка: дата окончания или null. Проверка доступа к закрытому и предупреждение при отзыве (ТЗ 6.5). */
export async function getActiveSubscriptionUntil(db: Db, tgId: number, now = new Date()): Promise<Date | null> {
  const s = await getSubscription(db, tgId, now)
  return s?.active ? s.endsAt : null
}

/** Кому пора напомнить: срок кончается в ближайшие 3 дня, напоминания ещё не было, бот не заблокирован (ТЗ 8.6). */
export async function dueReminders(db: Db, now = new Date()) {
  return db
    .select({ userId: subscriptions.userId, tgId: users.tgId, endsAt: subscriptions.endsAt })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        gt(subscriptions.endsAt, now),
        lte(subscriptions.endsAt, new Date(now.getTime() + 3 * DAY)),
        isNull(subscriptions.remindedAt),
        eq(users.botBlocked, false),
      ),
    )
}

export async function markReminded(db: Db, userId: number, now = new Date()) {
  await db.update(subscriptions).set({ remindedAt: now }).where(eq(subscriptions.userId, userId))
}

/** Число активных подписок — для сводки автора (ТЗ 8.6, 11.3). */
export async function countActiveSubscriptions(db: Db, now = new Date()): Promise<number> {
  const [row] = await db.select({ n: count() }).from(subscriptions).where(gt(subscriptions.endsAt, now))
  return row?.n ?? 0
}
