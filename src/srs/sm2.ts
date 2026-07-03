import type { Grade, SrsState } from '../db/schema'

/** 학습 단계 (분). 신규/재학습 카드는 이 단계를 통과해야 복습 카드로 졸업한다. */
export const LEARNING_STEPS_MIN = [1, 10]

const MIN_EF = 1.3
const MAX_EF = 2.8
const GRADUATE_DAYS = 1
const EASY_GRADUATE_DAYS = 4
const MAX_INTERVAL_DAYS = 3650

const MS_PER_MIN = 60_000
const MS_PER_DAY = 86_400_000

function clampEf(ef: number): number {
  return Math.min(MAX_EF, Math.max(MIN_EF, ef))
}

/**
 * SM-2 (Anki식 보정) 스케줄러. 순수 함수 — 상태를 변경하지 않고 다음 상태를 반환한다.
 * 등급: 0 다시 / 1 어려움 / 2 좋음 / 3 쉬움
 */
export function sm2(prev: SrsState, grade: Grade, now: number): SrsState {
  const next: SrsState = { ...prev, reps: prev.reps + 1, lastReviewedAt: now }

  if (prev.state === 'new' || prev.state === 'learning') {
    next.state = 'learning'
    switch (grade) {
      case 0:
        next.stepIndex = 0
        next.dueAt = now + LEARNING_STEPS_MIN[0] * MS_PER_MIN
        break
      case 1:
        next.dueAt = now + LEARNING_STEPS_MIN[Math.min(prev.stepIndex, LEARNING_STEPS_MIN.length - 1)] * MS_PER_MIN
        break
      case 2: {
        const step = prev.state === 'new' ? 0 : prev.stepIndex + 1
        if (prev.state !== 'new' && step >= LEARNING_STEPS_MIN.length) {
          next.state = 'review'
          next.stepIndex = 0
          next.intervalDays = GRADUATE_DAYS
          next.dueAt = now + GRADUATE_DAYS * MS_PER_DAY
        } else {
          next.stepIndex = step
          next.dueAt = now + LEARNING_STEPS_MIN[step] * MS_PER_MIN
        }
        break
      }
      case 3:
        next.state = 'review'
        next.stepIndex = 0
        next.intervalDays = EASY_GRADUATE_DAYS
        next.dueAt = now + EASY_GRADUATE_DAYS * MS_PER_DAY
        break
    }
    return next
  }

  // state === 'review'
  switch (grade) {
    case 0:
      next.state = 'learning'
      next.stepIndex = 0
      next.lapses = prev.lapses + 1
      next.ef = clampEf(prev.ef - 0.2)
      next.intervalDays = 0
      next.dueAt = now + LEARNING_STEPS_MIN[LEARNING_STEPS_MIN.length - 1] * MS_PER_MIN
      break
    case 1: {
      next.ef = clampEf(prev.ef - 0.15)
      next.intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(prev.intervalDays + 1, Math.round(prev.intervalDays * 1.2)))
      next.dueAt = now + next.intervalDays * MS_PER_DAY
      break
    }
    case 2: {
      next.intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(prev.intervalDays + 1, Math.round(prev.intervalDays * prev.ef)))
      next.dueAt = now + next.intervalDays * MS_PER_DAY
      break
    }
    case 3: {
      next.ef = clampEf(prev.ef + 0.15)
      next.intervalDays = Math.min(
        MAX_INTERVAL_DAYS,
        Math.max(prev.intervalDays + 1, Math.round(prev.intervalDays * prev.ef * 1.3)),
      )
      next.dueAt = now + next.intervalDays * MS_PER_DAY
      break
    }
  }
  return next
}
