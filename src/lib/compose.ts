import { toHiragana } from 'wanakana'

/**
 * 작문 퀴즈 채점.
 *
 * 앱 입력창은 로마자를 히라가나로 바꿔주는 방식이라 한자 입력을 강요할 수 없다.
 * 그래서 "가나로만 써도 정답"을 기본으로 하되, 일본어 키보드로 한자를 직접 친
 * 경우도 인정하도록 가나 정답·한자 정답 두 기준으로 채점해 더 높은 점수를 준다.
 */

/**
 * 채점에서 무시할 문장 부호 (표기 습관 차이로 감점되지 않게).
 * 장음 `ー`는 발음의 일부라 절대 넣지 않는다 — 빼면 コーヒー가 「こひ」가 된다.
 * 공백도 여기서 지우지 않는다 — 로마자 변환 전에 지우면 `hon o` 가 `ほの`로 뭉개진다.
 */
const PUNCT_RE = /[。、．，,.!！?？「」『』（）()・…]/g

/** 정답률이 이 값 이상이면 정답으로 집계한다 (오타 한두 글자는 통과) */
export const COMPOSE_PASS = 90

/** 부호를 걷어내고 히라가나로 통일 (가타카나·로마자 입력 모두 흡수) */
export function normalizeSentence(s: string): string {
  const cleaned = s.normalize('NFKC').replace(PUNCT_RE, '')
  if (!cleaned.trim()) return ''
  // 로마자 → 가나 변환을 먼저 하고, 그 뒤에 띄어쓰기를 지운다
  return toHiragana(cleaned).replace(/\s+/g, '')
}

export type DiffType = 'same' | 'missing' | 'extra'

export interface DiffOp {
  type: DiffType
  text: string
}

/**
 * 정답 대비 사용자 답의 글자 단위 차이.
 * - missing: 정답에는 있는데 사용자가 빠뜨린 글자
 * - extra: 사용자가 더 쓴(또는 잘못 쓴) 글자
 */
export function diffChars(expected: string, actual: string): DiffOp[] {
  const n = expected.length
  const m = actual.length
  // dp[i][j] = expected[i..], actual[j..] 를 맞추는 최소 편집 횟수
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) dp[i][m] = n - i
  for (let j = m - 1; j >= 0; j--) dp[n][j] = m - j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        expected[i] === actual[j]
          ? dp[i + 1][j + 1]
          : 1 + Math.min(dp[i + 1][j + 1], dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  const push = (type: DiffType, ch: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) last.text += ch
    else ops.push({ type, text: ch })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (expected[i] === actual[j]) {
      push('same', expected[i])
      i++
      j++
    } else if (dp[i][j] === 1 + dp[i + 1][j + 1]) {
      // 다른 글자로 씀 → 빠뜨린 글자와 잘못 쓴 글자를 함께 보여준다
      push('missing', expected[i])
      push('extra', actual[j])
      i++
      j++
    } else if (dp[i][j] === 1 + dp[i + 1][j]) {
      push('missing', expected[i])
      i++
    } else {
      push('extra', actual[j])
      j++
    }
  }
  while (i < n) push('missing', expected[i++])
  while (j < m) push('extra', actual[j++])
  return ops
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1])
    }
    prev = cur
  }
  return prev[b.length]
}

export interface ComposeResult {
  /** 정답률 0~100 */
  percent: number
  correct: boolean
  /** 어떤 기준으로 채점됐는지 — 한자로 쓴 사용자에게 맞춰 표시를 바꾼다 */
  matched: 'kana' | 'kanji'
  /** 정답 대비 차이 (정규화된 글자 기준) */
  diff: DiffOp[]
  normalizedInput: string
  normalizedExpected: string
}

function scoreAgainst(input: string, expected: string) {
  const a = normalizeSentence(input)
  const e = normalizeSentence(expected)
  const longest = Math.max(a.length, e.length)
  const percent = longest === 0 ? 0 : Math.round((1 - editDistance(e, a) / longest) * 100)
  return { a, e, percent: Math.max(0, Math.min(100, percent)) }
}

const KANJI_RE = /[一-鿿々〆ヵヶ]/

/**
 * 가나로 쓴 답은 가나 정답과, 한자를 섞어 쓴 답은 한자 정답과 비교한다.
 *
 * 사용자가 한자를 한 글자도 안 썼는데 한자 정답과 비교하면
 * 정답의 한자가 전부 "빠뜨린 글자"로 표시돼 피드백이 무의미해진다.
 */
export function scoreCompose(
  input: string,
  expectedKana: string,
  expectedKanji: string,
): ComposeResult {
  const kana = scoreAgainst(input, expectedKana)
  const usedKanji = KANJI_RE.test(kana.a)
  // 한자를 섞어 쓴 경우에만 한자 정답과도 견줘 더 나은 쪽을 쓴다
  const kanji = usedKanji ? scoreAgainst(input, expectedKanji) : null
  const best = kanji && kanji.percent > kana.percent ? kanji : kana
  return {
    percent: best.percent,
    correct: best.percent >= COMPOSE_PASS,
    matched: kanji && best === kanji ? 'kanji' : 'kana',
    diff: diffChars(best.e, best.a),
    normalizedInput: best.a,
    normalizedExpected: best.e,
  }
}

/** 점수대별 피드백 문구 */
export function composeVerdict(percent: number): { emoji: string; label: string } {
  if (percent === 100) return { emoji: '🎉', label: '완벽해요!' }
  if (percent >= COMPOSE_PASS) return { emoji: '✨', label: '정답! 사소한 차이만 있어요' }
  if (percent >= 60) return { emoji: '🔶', label: '조금만 더!' }
  if (percent > 0) return { emoji: '❌', label: '다시 도전해 볼까요' }
  return { emoji: '❌', label: '정답을 확인해 보세요' }
}
