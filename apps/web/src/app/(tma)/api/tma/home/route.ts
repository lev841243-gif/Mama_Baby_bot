import { ageInMonths, ageSection, getChildBirth, getFeedState, getLastOpened, getSettings, listDone } from '@mama/shared'
import { NextResponse } from 'next/server'
import { cardsOut, listCards, sectionInfo } from '@/lib/content'
import { getDb, tmaRoute } from '@/lib/server'
import type { HomePayload } from '@/lib/tma-types'

export const dynamic = 'force-dynamic'

/** Главная (ТЗ 8.1): разделы по возрасту, «ваш раздел», «Продолжить», «Новое от автора». */
export const POST = tmaRoute(async ({ tgId }) => {
  const db = getDb()
  const [cards, settings, birth, lastId, done, feed] = await Promise.all([
    listCards(),
    getSettings(db),
    getChildBirth(db, tgId),
    getLastOpened(db, tgId),
    listDone(db, tgId),
    getFeedState(db, tgId),
  ])
  const months = birth ? ageInMonths(birth.year, birth.month) : null
  const last = lastId ? cards.find((c) => c.id === lastId) : undefined
  const fresh = [...cards]
    .filter((c) => c.publishedAt)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 5)
  const body: HomePayload = {
    sections: sectionInfo(cards.filter((c) => c.type === 'exercise' || c.type === 'article'), settings),
    yourSection: months === null ? null : ageSection(months),
    tooYoung: months !== null && months < 3,
    birth,
    continue: last ? cardsOut([last], done)[0]! : null,
    fresh: cardsOut(fresh, done),
    feedSetup: feed.consent && !feed.settings,
  }
  return NextResponse.json(body)
})
