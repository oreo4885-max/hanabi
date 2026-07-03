import { db, type Card, type SrsState } from '../db/schema'
import { getSetting } from '../db/schema'
import { todayStr } from '../lib/dates'

export interface QueueItem {
  card: Card
  srs: SrsState
}

export const DEFAULT_NEW_LIMIT = 10
export const DEFAULT_REVIEW_LIMIT = 100

/** 오늘의 학습 큐 = due 복습(한도 내) + 신규(일일 한도에서 오늘 소진분 차감), 인터리브. */
export async function buildDailyQueue(deckId?: string): Promise<QueueItem[]> {
  const now = Date.now()
  const newLimit = await getSetting('dailyNewLimit', DEFAULT_NEW_LIMIT)
  const reviewLimit = await getSetting('dailyReviewLimit', DEFAULT_REVIEW_LIMIT)
  const today = await db.dailyStats.get(todayStr())
  const newBudget = Math.max(0, newLimit - (today?.newCards ?? 0))

  let dueRows = await db.srs
    .where('dueAt')
    .belowOrEqual(now)
    .and((s) => s.state !== 'new' && (!deckId || s.deckId === deckId))
    .toArray()
  dueRows.sort((a, b) => a.dueAt - b.dueAt)
  dueRows = dueRows.slice(0, reviewLimit)

  let newRows = await db.srs
    .where('state')
    .equals('new')
    .and((s) => !deckId || s.deckId === deckId)
    .limit(newBudget)
    .toArray()
  newRows = newRows.slice(0, newBudget)

  const rows = interleave(dueRows, newRows)
  const cards = await db.cards.bulkGet(rows.map((r) => r.cardId))
  return rows
    .map((srs, i) => ({ srs, card: cards[i] }))
    .filter((item): item is QueueItem => item.card !== undefined)
}

/** 복습 사이에 신규 카드를 고르게 섞는다. */
function interleave(reviews: SrsState[], news: SrsState[]): SrsState[] {
  if (news.length === 0) return reviews
  if (reviews.length === 0) return news
  const result: SrsState[] = []
  const gap = Math.max(1, Math.floor(reviews.length / news.length))
  let ni = 0
  for (let ri = 0; ri < reviews.length; ri++) {
    result.push(reviews[ri])
    if ((ri + 1) % gap === 0 && ni < news.length) result.push(news[ni++])
  }
  while (ni < news.length) result.push(news[ni++])
  return result
}

/** 대시보드용 카운트 */
export async function getDueCounts(): Promise<{ due: number; fresh: number }> {
  const now = Date.now()
  const due = await db.srs
    .where('dueAt')
    .belowOrEqual(now)
    .and((s) => s.state !== 'new')
    .count()
  const newLimit = await getSetting('dailyNewLimit', DEFAULT_NEW_LIMIT)
  const today = await db.dailyStats.get(todayStr())
  const newBudget = Math.max(0, newLimit - (today?.newCards ?? 0))
  const totalNew = await db.srs.where('state').equals('new').count()
  return { due, fresh: Math.min(newBudget, totalNew) }
}
