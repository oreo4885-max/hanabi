import { create } from 'zustand'
import type { QueueItem } from '../srs/queue'

export type QuizMode =
  | 'word-to-meaning'
  | 'meaning-to-word'
  | 'typed'
  | 'dictation'
  | 'cloze'
  /** 한국어 문장을 보고 일본어 문장을 직접 타이핑하는 작문 */
  | 'compose'

export interface QuizConfig {
  deckId: string
  mode: QuizMode
  count: number
}

/** 진행 중인 복습 세션 — 단어장에 다녀와도 보던 카드로 돌아오기 위해 보관한다 */
export interface ReviewSession {
  /** 특정 덱만 학습 중이면 그 id (전체 학습이면 undefined) */
  deckId?: string
  queue: QueueItem[]
  done: number
  /** 답을 이미 펼친 상태였는지 */
  flipped: boolean
}

interface SessionState {
  quiz: QuizConfig | null
  setQuiz: (q: QuizConfig | null) => void

  review: ReviewSession | null
  setReview: (r: ReviewSession | null) => void
  updateReview: (patch: Partial<ReviewSession>) => void
}

export const useSession = create<SessionState>((set) => ({
  quiz: null,
  setQuiz: (quiz) => set({ quiz }),

  review: null,
  setReview: (review) => set({ review }),
  updateReview: (patch) =>
    set((s) => (s.review ? { review: { ...s.review, ...patch } } : s)),
}))
