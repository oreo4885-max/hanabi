import Dexie, { type EntityTable } from 'dexie'

export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type Grade = 0 | 1 | 2 | 3 // 다시 / 어려움 / 좋음 / 쉬움
export type StudyMode = 'flash' | 'quiz' | 'micro'

export interface Deck {
  id: string
  name: string
  level: Level | null
  source: 'bundled' | 'custom'
  createdAt: number
  cardCount: number
}

export interface Card {
  id: string
  deckId: string
  kanji: string
  kana: string
  ko: string
  pos?: string
  exJa?: string
  exKo?: string
  /** 의미 연상용 이모지 힌트 (구체어 위주, 없을 수 있음) */
  emoji?: string
  /** 한국식 발음 연상 암기 문장 (**소리** 강조 마크 포함) */
  mnemonic?: string
  level?: Level
  flagged?: boolean
}

export type SrsCardState = 'new' | 'learning' | 'review'

export interface SrsState {
  cardId: string
  deckId: string
  state: SrsCardState
  ef: number
  intervalDays: number
  stepIndex: number
  reps: number
  lapses: number
  dueAt: number
  lastReviewedAt: number | null
}

export interface ReviewLogEntry {
  id?: number
  cardId: string
  reviewedAt: number
  grade: Grade
  mode: StudyMode
  msToAnswer?: number
  newIntervalDays?: number
}

export interface DailyStats {
  date: string // YYYY-MM-DD (local)
  reviews: number
  newCards: number
  quizTotal: number
  quizCorrect: number
  microSessions: number
  studySeconds: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('hanabi') as Dexie & {
  decks: EntityTable<Deck, 'id'>
  cards: EntityTable<Card, 'id'>
  srs: EntityTable<SrsState, 'cardId'>
  reviewLog: EntityTable<ReviewLogEntry, 'id'>
  dailyStats: EntityTable<DailyStats, 'date'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  decks: 'id, level, source',
  cards: 'id, deckId, level',
  srs: 'cardId, deckId, dueAt, state, [deckId+state]',
  reviewLog: '++id, cardId, reviewedAt',
  dailyStats: 'date',
  settings: 'key',
})

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
