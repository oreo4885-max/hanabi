import { describe, expect, it } from 'vitest'
import type { SrsState } from '../db/schema'
import { scheduleFsrs } from './fsrs'

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

describe('scheduleFsrs', () => {
  it('신규 카드에 좋음 → 학습 단계 진입 (10분 내 due)', () => {
    const next = scheduleFsrs(newCard(), 2, NOW)
    expect(next.state).toBe('learning')
    expect(next.dueAt).toBeGreaterThan(NOW)
    expect(next.dueAt).toBeLessThanOrEqual(NOW + 15 * MIN)
    expect(next.stability).toBeGreaterThan(0)
    expect(next.difficulty).toBeGreaterThan(0)
  })

  it('신규 카드에 쉬움 → 하루 이상 뒤로 졸업', () => {
    const next = scheduleFsrs(newCard(), 3, NOW)
    expect(next.state).toBe('review')
    expect(next.dueAt).toBeGreaterThanOrEqual(NOW + 1 * DAY)
  })

  it('학습 단계에서 좋음 연타 → 복습으로 졸업', () => {
    let s = scheduleFsrs(newCard(), 2, NOW)
    s = scheduleFsrs(s, 2, NOW + 2 * MIN)
    s = scheduleFsrs(s, 2, NOW + 15 * MIN)
    expect(s.state).toBe('review')
    expect(s.dueAt).toBeGreaterThan(NOW + 1 * DAY)
  })

  it('복습 카드에 다시 → lapses 증가 + 재학습 강등', () => {
    let s = scheduleFsrs(newCard(), 3, NOW) // 바로 졸업
    const lapsesBefore = s.lapses
    s = scheduleFsrs(s, 0, s.dueAt)
    expect(s.lapses).toBe(lapsesBefore + 1)
    expect(s.state).toBe('learning')
  })

  it('SM-2 시절 카드(FSRS 필드 없음)도 근사 이전되어 스케줄된다', () => {
    const legacy = newCard({
      state: 'review',
      intervalDays: 6,
      reps: 3,
      dueAt: NOW - DAY,
      lastReviewedAt: NOW - 7 * DAY,
    })
    const next = scheduleFsrs(legacy, 2, NOW)
    expect(next.state).toBe('review')
    expect(next.dueAt).toBeGreaterThan(NOW + 3 * DAY) // interval 성장
    expect(next.stability).toBeGreaterThan(0)
    expect(next.fsrsState).toBeDefined()
  })

  it('쉬움이 좋음보다 더 긴 간격을 준다', () => {
    const base = newCard({ state: 'review', intervalDays: 10, reps: 5, stability: 10, difficulty: 5, dueAt: NOW, fsrsState: 2 })
    const good = scheduleFsrs(base, 2, NOW)
    const easy = scheduleFsrs(base, 3, NOW)
    expect(easy.dueAt).toBeGreaterThan(good.dueAt)
  })
})
