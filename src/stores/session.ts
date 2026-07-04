import { create } from 'zustand'

export type QuizMode = 'word-to-meaning' | 'meaning-to-word' | 'typed' | 'dictation' | 'cloze'

export interface QuizConfig {
  deckId: string
  mode: QuizMode
  count: number
}

interface SessionState {
  quiz: QuizConfig | null
  setQuiz: (q: QuizConfig | null) => void
}

export const useSession = create<SessionState>((set) => ({
  quiz: null,
  setQuiz: (quiz) => set({ quiz }),
}))
