import { describe, expect, it } from 'vitest'
import type { SrsState } from '../db/schema'
import { sm2 } from './sm2'

const NOW = 1_750_000_000_000
const MIN = 60_000
const DAY = 86_400_000

function newCard(over: Partial<SrsState> = {}): SrsState {
  return {
    cardId: 'c1',
    deckId: 'd1',
    state: 'new',
    ef: 2.5,
    intervalDays: 0,
    stepIndex: 0,
    reps: 0,
    lapses: 0,
    dueAt: 0,
    lastReviewedAt: null,
    ...over,
  }
}

describe('sm2 — 신규/학습 카드', () => {
  it('신규 카드에 좋음 → 첫 학습 단계(1분)', () => {
    const next = sm2(newCard(), 2, NOW)
    expect(next.state).toBe('learning')
    expect(next.stepIndex).toBe(0)
    expect(next.dueAt).toBe(NOW + 1 * MIN)
  })

  it('학습 1단계에서 좋음 → 2단계(10분)', () => {
    const s = newCard({ state: 'learning', stepIndex: 0 })
    const next = sm2(s, 2, NOW)
    expect(next.state).toBe('learning')
    expect(next.stepIndex).toBe(1)
    expect(next.dueAt).toBe(NOW + 10 * MIN)
  })

  it('마지막 학습 단계에서 좋음 → 복습으로 졸업(1일)', () => {
    const s = newCard({ state: 'learning', stepIndex: 1 })
    const next = sm2(s, 2, NOW)
    expect(next.state).toBe('review')
    expect(next.intervalDays).toBe(1)
    expect(next.dueAt).toBe(NOW + 1 * DAY)
  })

  it('학습 중 다시 → 1단계로 리셋', () => {
    const s = newCard({ state: 'learning', stepIndex: 1 })
    const next = sm2(s, 0, NOW)
    expect(next.state).toBe('learning')
    expect(next.stepIndex).toBe(0)
    expect(next.dueAt).toBe(NOW + 1 * MIN)
  })

  it('신규 카드에 쉬움 → 즉시 졸업(4일)', () => {
    const next = sm2(newCard(), 3, NOW)
    expect(next.state).toBe('review')
    expect(next.intervalDays).toBe(4)
    expect(next.dueAt).toBe(NOW + 4 * DAY)
  })
})

describe('sm2 — 복습 카드', () => {
  const review = (over: Partial<SrsState> = {}) =>
    newCard({ state: 'review', intervalDays: 6, ef: 2.5, reps: 3, ...over })

  it('좋음 → interval × EF', () => {
    const next = sm2(review(), 2, NOW)
    expect(next.intervalDays).toBe(15) // round(6 × 2.5)
    expect(next.dueAt).toBe(NOW + 15 * DAY)
    expect(next.ef).toBe(2.5)
  })

  it('쉬움 → interval × EF × 1.3, EF 증가', () => {
    const next = sm2(review(), 3, NOW)
    expect(next.intervalDays).toBe(20) // round(6 × 2.5 × 1.3) = 19.5 → 20
    expect(next.ef).toBe(2.65)
  })

  it('어려움 → interval × 1.2, EF 감소', () => {
    const next = sm2(review(), 1, NOW)
    expect(next.intervalDays).toBe(7) // round(6 × 1.2)
    expect(next.ef).toBe(2.35)
  })

  it('다시 → 재학습으로 강등, lapses 증가, EF -0.2', () => {
    const next = sm2(review(), 0, NOW)
    expect(next.state).toBe('learning')
    expect(next.lapses).toBe(1)
    expect(next.ef).toBe(2.3)
    expect(next.dueAt).toBe(NOW + 10 * MIN)
  })

  it('EF 하한 1.3 유지', () => {
    const next = sm2(review({ ef: 1.35 }), 0, NOW)
    expect(next.ef).toBe(1.3)
  })

  it('interval은 항상 최소 1일 증가', () => {
    const next = sm2(review({ intervalDays: 1, ef: 1.3 }), 1, NOW)
    expect(next.intervalDays).toBeGreaterThanOrEqual(2)
  })

  it('reps는 매 평가마다 증가', () => {
    const next = sm2(review({ reps: 5 }), 2, NOW)
    expect(next.reps).toBe(6)
  })
})
