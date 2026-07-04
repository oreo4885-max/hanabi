import type { Card } from '../../db/schema'
import type { QuizMode } from '../../stores/session'

export interface Question {
  card: Card
  /** 객관식 보기 (정답 포함, 섞인 상태). 주관식/받아쓰기는 undefined */
  choices?: Card[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 같은 품사 우선으로 오답 보기 3개를 뽑는다. */
function pickDistractors(target: Card, pool: Card[], n = 3): Card[] {
  const others = pool.filter((c) => c.id !== target.id && c.ko !== target.ko)
  const samePos = shuffle(others.filter((c) => c.pos && c.pos === target.pos))
  const rest = shuffle(others.filter((c) => !c.pos || c.pos !== target.pos))
  return [...samePos, ...rest].slice(0, n)
}

/** "A; B" 표제어의 첫 변형 */
export function firstVariant(kanji: string): string {
  return kanji.split(';')[0].trim()
}

/** 예문 속 표제어를 빈칸으로 */
export function makeCloze(card: Card): string | null {
  if (!card.exJa) return null
  const head = firstVariant(card.kanji)
  if (!card.exJa.includes(head)) return null
  return card.exJa.replace(head, '（　　）')
}

export function generateQuestions(pool: Card[], mode: QuizMode, count: number): Question[] {
  const effectivePool = mode === 'cloze' ? pool.filter((c) => makeCloze(c) !== null) : pool
  const targets = shuffle(effectivePool).slice(0, count)
  const isChoice = mode === 'word-to-meaning' || mode === 'meaning-to-word' || mode === 'cloze'
  return targets.map((card) => ({
    card,
    choices: isChoice ? shuffle([card, ...pickDistractors(card, effectivePool)]) : undefined,
  }))
}
