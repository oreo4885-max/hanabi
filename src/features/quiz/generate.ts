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

const KANJI_RE = /[一-鿿々〆ヵヶ]/

/** "음료, 마실 것" → ["음료", "마실 것"] */
function senses(ko: string): string[] {
  return ko
    .split(/[,;/]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean)
}

function bigrams(s: string): Set<string> {
  const t = s.replace(/[\s,;()~·]/g, '')
  const out = new Set<string>()
  if (t.length === 1) out.add(t)
  for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2))
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1])
    }
    prev = cur
  }
  return prev[b.length]
}

function kanaSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 0 : 1 - levenshtein(a, b) / longest
}

/** 표제어가 한자를 공유하는 정도 — 会う/会社처럼 헷갈리는 짝을 찾는다 */
function kanjiOverlap(a: string, b: string): number {
  const A = new Set([...a].filter((c) => KANJI_RE.test(c)))
  const B = new Set([...b].filter((c) => KANJI_RE.test(c)))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / Math.max(A.size, B.size)
}

/**
 * 정답과 얼마나 헷갈리는 보기인지 점수를 매긴다.
 *
 * 보기가 정답과 전혀 딴판이면 뜻을 몰라도 소거법으로 맞힐 수 있다.
 * 그래서 뜻을 고르는 문제는 '뜻이 비슷한' 보기를, 단어를 고르는 문제는
 * '생김새·발음이 닮은' 보기를 우선한다.
 */
function confusability(target: Card, c: Card, meaningFocused: boolean): number {
  let score = 0
  if (c.pos && c.pos === target.pos) score += meaningFocused ? 0.5 : 0.35
  const meaning = jaccard(bigrams(target.ko), bigrams(c.ko))
  const form =
    kanjiOverlap(firstVariant(target.kanji), firstVariant(c.kanji)) * 0.7 +
    kanaSimilarity(target.kana, c.kana) * 0.5
  score += meaningFocused ? meaning * 2 + form * 0.4 : form * 2 + meaning * 0.4
  // 길이가 비슷하면 눈으로 걸러내기 어렵다
  if (Math.abs(target.kana.length - c.kana.length) <= 1) score += 0.15
  return score
}

/** 상위 후보를 이만큼 모아 두고 그중에서 뽑는다 (매번 같은 보기가 나오지 않도록) */
const CANDIDATE_POOL = 12

/**
 * 정답과 헷갈리는 오답 보기 3개를 뽑는다.
 * 뜻이 겹치는 단어는 '정답이나 마찬가지'라 아예 후보에서 뺀다.
 */
export function pickDistractors(
  target: Card,
  pool: Card[],
  meaningFocused: boolean,
  n = 3,
): Card[] {
  const targetSenses = new Set(senses(target.ko))
  const others = pool.filter(
    (c) => c.id !== target.id && !senses(c.ko).some((s) => targetSenses.has(s)),
  )
  const ranked = others
    .map((c) => ({ c, score: confusability(target, c, meaningFocused) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL)
    .map((x) => x.c)
  return shuffle(ranked).slice(0, n)
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

/**
 * 작문 문제로 쓸 수 있는 카드인지.
 * 한국어 해석(문제)과 후리가나 예문(가나 정답)이 둘 다 있어야 채점이 가능하다.
 * 후리가나가 있는 N5·N4에서만 문제가 만들어진다.
 */
export function isComposable(card: Card): boolean {
  return !!card.exJa && !!card.exKo && !!card.exFuri
}

export function generateQuestions(pool: Card[], mode: QuizMode, count: number): Question[] {
  const effectivePool =
    mode === 'cloze'
      ? pool.filter((c) => makeCloze(c) !== null)
      : mode === 'compose'
        ? pool.filter(isComposable)
        : pool
  const targets = shuffle(effectivePool).slice(0, count)
  const isChoice = mode === 'word-to-meaning' || mode === 'meaning-to-word' || mode === 'cloze'
  // 뜻을 고르는 문제는 뜻이 비슷한 보기를, 단어를 고르는 문제는 형태가 닮은 보기를 낸다
  const meaningFocused = mode === 'word-to-meaning'
  return targets.map((card) => ({
    card,
    choices: isChoice
      ? shuffle([card, ...pickDistractors(card, effectivePool, meaningFocused)])
      : undefined,
  }))
}
