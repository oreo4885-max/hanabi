import type { DailyStats } from '../db/schema'
import { addDays, todayStr } from './dates'

/** 그 날 학습으로 인정되는 최소 활동 */
export function isActiveDay(d: DailyStats): boolean {
  return d.reviews + d.quizTotal + d.microSessions > 0
}

/**
 * 현재 연속 학습일. 오늘 활동이 없으면 어제까지의 연속만 인정
 * (오늘은 아직 끝나지 않았으므로 스트릭을 깨지 않는다).
 */
export function currentStreak(days: DailyStats[], today: string = todayStr()): number {
  const active = new Set(days.filter(isActiveDay).map((d) => d.date))
  let cursor = active.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (active.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 역대 최장 연속 학습일 */
export function bestStreak(days: DailyStats[]): number {
  const dates = days.filter(isActiveDay).map((d) => d.date).sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const date of dates) {
    run = prev !== null && addDays(prev, 1) === date ? run + 1 : 1
    best = Math.max(best, run)
    prev = date
  }
  return best
}
