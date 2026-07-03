import { describe, expect, it } from 'vitest'
import type { DailyStats } from '../db/schema'
import { bestStreak, currentStreak } from './streak'

function day(date: string, reviews = 1): DailyStats {
  return { date, reviews, newCards: 0, quizTotal: 0, quizCorrect: 0, microSessions: 0, studySeconds: 0 }
}

describe('currentStreak', () => {
  it('활동 없음 → 0', () => {
    expect(currentStreak([], '2026-07-04')).toBe(0)
  })

  it('오늘만 활동 → 1', () => {
    expect(currentStreak([day('2026-07-04')], '2026-07-04')).toBe(1)
  })

  it('오늘 아직 안 했어도 어제까지의 연속은 유지', () => {
    expect(currentStreak([day('2026-07-03'), day('2026-07-02')], '2026-07-04')).toBe(2)
  })

  it('중간에 빠진 날이 있으면 거기서 끊김', () => {
    expect(
      currentStreak([day('2026-07-04'), day('2026-07-03'), day('2026-07-01')], '2026-07-04'),
    ).toBe(2)
  })

  it('그저께가 마지막 활동이면 0 (어제 끊김)', () => {
    expect(currentStreak([day('2026-07-02')], '2026-07-04')).toBe(0)
  })

  it('월 경계를 넘는 연속 계산', () => {
    expect(
      currentStreak([day('2026-07-01'), day('2026-06-30'), day('2026-06-29')], '2026-07-01'),
    ).toBe(3)
  })

  it('reviews가 0이고 다른 활동도 없으면 활동일로 치지 않음', () => {
    expect(currentStreak([day('2026-07-04', 0)], '2026-07-04')).toBe(0)
  })
})

describe('bestStreak', () => {
  it('가장 긴 연속 구간을 찾는다', () => {
    const days = [
      day('2026-06-01'), day('2026-06-02'),
      day('2026-06-10'), day('2026-06-11'), day('2026-06-12'),
      day('2026-07-01'),
    ]
    expect(bestStreak(days)).toBe(3)
  })

  it('빈 배열 → 0', () => {
    expect(bestStreak([])).toBe(0)
  })
})
