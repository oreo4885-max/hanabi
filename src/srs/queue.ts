import { db, type Card, type Level, type SrsState } from '../db/schema'
import { getSetting } from '../db/schema'
import { todayStr } from '../lib/dates'
import { deckIdsForTarget } from '../lib/levels'

export interface QueueItem {
  card: Card
  srs: SrsState
}

export const DEFAULT_NEW_LIMIT = 10
export const DEFAULT_REVIEW_LIMIT = 100
/** 목표 레벨 기본값: 전 레벨 학습 (온보딩에서 변경) */
export const DEFAULT_TARGET_LEVEL: Level = 'N1'

/** 취약 단어 기준: 이 횟수 이상 "다시"를 누른 카드 */
export const WEAK_LAPSES = 2
const WEAK_SESSION_CAP = 50

/**
 * 목표 레벨에 포함되는 덱 id 집합. 커스텀 덱은 항상 포함한다.
 * deckId가 지정되면 그 덱만 대상이므로 이 필터는 쓰지 않는다.
 */
async function allowedDeckIds(): Promise<Set<string>> {
  const target = await getSetting<Level>('targetLevel', DEFAULT_TARGET_LEVEL)
  const ids = new Set(deckIdsForTarget(target))
  const custom = await db.decks.where('source').equals('custom').primaryKeys()
  for (const id of custom as string[]) ids.add(id)
  return ids
}

/** 취약 단어(자주 틀린 카드)를 lapses 많은 순으로. due와 무관한 집중 연습용. */
export async function buildWeakQueue(): Promise<QueueItem[]> {
  const allowed = await allowedDeckIds()
  const rows = await db.srs
    .filter((s) => s.lapses >= WEAK_LAPSES && allowed.has(s.deckId))
    .toArray()
  rows.sort((a, b) => b.lapses - a.lapses)
  const capped = rows.slice(0, WEAK_SESSION_CAP)
  const cards = await db.cards.bulkGet(capped.map((r) => r.cardId))
  return capped
    .map((srs, i) => ({ srs, card: cards[i] }))
    .filter((item): item is QueueItem => item.card !== undefined)
}

export async function getWeakCount(): Promise<number> {
  const allowed = await allowedDeckIds()
  return db.srs.filter((s) => s.lapses >= WEAK_LAPSES && allowed.has(s.deckId)).count()
}

/** 오늘의 학습 큐 = due 복습(한도 내) + 신규(일일 한도에서 오늘 소진분 차감), 인터리브. */
export async function buildDailyQueue(deckId?: string): Promise<QueueItem[]> {
  if (deckId === 'weak') return buildWeakQueue()
  const now = Date.now()
  const newLimit = await getSetting('dailyNewLimit', DEFAULT_NEW_LIMIT)
  const reviewLimit = await getSetting('dailyReviewLimit', DEFAULT_REVIEW_LIMIT)
  const today = await db.dailyStats.get(todayStr())
  const newBudget = Math.max(0, newLimit - (today?.newCards ?? 0))
  // 덱을 콕 집어 학습할 때는 목표 레벨 제한을 적용하지 않는다
  const allowed = deckId ? null : await allowedDeckIds()
  const inScope = (s: SrsState) => (deckId ? s.deckId === deckId : allowed!.has(s.deckId))

  let dueRows = await db.srs
    .where('dueAt')
    .belowOrEqual(now)
    .and((s) => s.state !== 'new' && inScope(s))
    .toArray()
  dueRows.sort((a, b) => a.dueAt - b.dueAt)
  dueRows = dueRows.slice(0, reviewLimit)

  let newRows = await db.srs
    .where('state')
    .equals('new')
    .and(inScope)
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

/** 대시보드용 카운트 (목표 레벨 범위 기준) */
export async function getDueCounts(): Promise<{ due: number; fresh: number }> {
  const now = Date.now()
  const allowed = await allowedDeckIds()
  const due = await db.srs
    .where('dueAt')
    .belowOrEqual(now)
    .and((s) => s.state !== 'new' && allowed.has(s.deckId))
    .count()
  const newLimit = await getSetting('dailyNewLimit', DEFAULT_NEW_LIMIT)
  const today = await db.dailyStats.get(todayStr())
  const newBudget = Math.max(0, newLimit - (today?.newCards ?? 0))
  const totalNew = await db.srs
    .where('state')
    .equals('new')
    .and((s) => allowed.has(s.deckId))
    .count()
  return { due, fresh: Math.min(newBudget, totalNew) }
}
