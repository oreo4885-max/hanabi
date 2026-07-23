import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
} from 'ts-fsrs'
import type { Grade, SrsState } from '../db/schema'

/** 학습 단계는 기존 SM-2와 동일한 체감(1분→10분)을 유지 */
const engine = fsrs(
  generatorParameters({
    enable_fuzz: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }),
)

const RATING: Record<Grade, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  0: Rating.Again,
  1: Rating.Hard,
  2: Rating.Good,
  3: Rating.Easy,
}

/**
 * SrsState → ts-fsrs Card.
 * FSRS 필드가 없는 기존(SM-2) 카드는 근사값으로 1회성 이전:
 * stability ≈ 기존 interval, difficulty는 중간값 5.
 */
function toFsrsCard(s: SrsState, now: number): FsrsCard {
  if (s.state === 'new') return createEmptyCard(new Date(now))

  if (s.stability === undefined || s.difficulty === undefined) {
    return {
      due: new Date(s.dueAt || now),
      stability: Math.max(0.1, s.intervalDays || 0.1),
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: s.intervalDays,
      learning_steps: 0,
      reps: s.reps,
      lapses: s.lapses,
      state: s.state === 'review' ? State.Review : State.Learning,
      last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
    }
  }

  return {
    due: new Date(s.dueAt),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: 0,
    scheduled_days: s.scheduledDays ?? s.intervalDays,
    learning_steps: s.learningSteps ?? 0,
    reps: s.reps,
    lapses: s.lapses,
    state: (s.fsrsState ?? State.Review) as State,
    last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
  }
}

function toAppState(st: State): SrsState['state'] {
  if (st === State.Review) return 'review'
  if (st === State.New) return 'new'
  return 'learning' // Learning + Relearning
}

/** FSRS 스케줄러 — sm2()와 같은 시그니처의 순수 함수 */
export function scheduleFsrs(prev: SrsState, grade: Grade, now: number): SrsState {
  const { card } = engine.next(toFsrsCard(prev, now), new Date(now), RATING[grade])
  return {
    ...prev,
    state: toAppState(card.state),
    intervalDays: card.scheduled_days,
    stepIndex: 0,
    reps: card.reps,
    lapses: card.lapses,
    dueAt: card.due.getTime(),
    lastReviewedAt: now,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    fsrsState: card.state,
  }
}
