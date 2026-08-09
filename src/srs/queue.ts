import { db, type Card, type Level, type SrsState } from '../db/schema'
import { getSetting } from '../db/schema'
import { todayStr } from '../lib/dates'
import { deckIdsForTarget, isGrammarCard } from '../lib/levels'

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

/**
 * 새 카드를 쉬운 레벨(N5)부터 필요한 만큼만 모은다.
 * 한 레벨 안에서는 문형보다 **단어를 먼저** 도입한다 (문형은 단어를 알아야 이해되므로).
 */
async function collectNewCards(target: Level, budget: number): Promise<SrsState[]> {
  if (budget <= 0) return []
  const out: SrsState[] = []
  // 사용자가 만든 덱은 기본 덱을 다 소진한 뒤에 도입
  const custom = (await db.decks.where('source').equals('custom').primaryKeys()) as string[]

  for (const id of [...deckIdsForTarget(target), ...custom]) {
    if (out.length >= budget) break
    const rows = await db.srs.where('[deckId+state]').equals([id, 'new']).toArray()
    // 사전 순서 그대로면 青 / 青い 처럼 비슷한 말이 줄줄이 나오므로 무작위로 섞는다.
    // 단어를 먼저 도입하는 원칙은 유지.
    const words = shuffle(rows.filter((r) => !isGrammarCard(r.cardId)))
    const grammar = shuffle(rows.filter((r) => isGrammarCard(r.cardId)))
    out.push(...[...words, ...grammar].slice(0, budget - out.length))
  }
  return out.slice(0, budget)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 헷갈리기 쉬운 카드가 잇달아 나오지 않게 하는 기준 (표제어 첫 글자) */
function similarKey(item: QueueItem): string {
  const head = item.card.kanji.replace(/[〜～\s]/g, '')
  return (head || item.card.kana).slice(0, 1)
}

/** 같은 첫 글자(青/青い 등)가 연속되지 않도록 순서를 재배치한다. */
function spreadSimilar(items: QueueItem[]): QueueItem[] {
  const pending = [...items]
  const out: QueueItem[] = []
  while (pending.length > 0) {
    const prev = out.length > 0 ? similarKey(out[out.length - 1]) : null
    let idx = prev === null ? 0 : pending.findIndex((it) => similarKey(it) !== prev)
    if (idx === -1) idx = 0 // 남은 게 전부 같은 계열이면 어쩔 수 없이 이어서
    out.push(pending.splice(idx, 1)[0])
  }
  return out
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

  const newRows = deckId
    ? (await db.srs.where('[deckId+state]').equals([deckId, 'new']).limit(newBudget).toArray())
    : await collectNewCards(await getSetting<Level>('targetLevel', DEFAULT_TARGET_LEVEL), newBudget)

  const rows = interleave(dueRows, newRows)
  const cards = await db.cards.bulkGet(rows.map((r) => r.cardId))
  const items = rows
    .map((srs, i) => ({ srs, card: cards[i] }))
    .filter((item): item is QueueItem => item.card !== undefined)
  return spreadSimilar(items)
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
