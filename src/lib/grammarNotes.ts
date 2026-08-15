/**
 * 작문 답안이 모범 답안과 다를 때 "왜 다른지"를 설명한다.
 *
 * 앱은 오프라인이라 실행 중에 AI를 부를 수 없다. 대신 초급자가 자주 틀리는
 * 문법 짝(います/あります, は/が, に/で …)을 규칙으로 잡아 짧은 해설을 붙인다.
 * 규칙은 '모범 답안에는 A가 있고 내 답에는 B가 있다'가 분명할 때만 발동해
 * 엉뚱한 설명이 붙지 않게 한다.
 */

import type { DiffOp } from './compose'

export interface GrammarNote {
  /** 한 줄 제목 — 무엇을 헷갈렸는지 */
  title: string
  /** 두 줄 이내 설명 */
  detail: string
}

interface Rule {
  /** 모범 답안 쪽에 있어야 하는 표현 (없으면 조건 없음) */
  expected?: RegExp
  /** 내 답 쪽에 있어야 하는 표현 */
  actual: RegExp
  /** 이 규칙이 의미를 가지려면 모범 답안에 함께 있어야 하는 표현 */
  context?: RegExp
  /**
   * 조사처럼 한 글자짜리 규칙은 문자열에 들어 있다는 것만으로는 근거가 약하다.
   * (「です」의 で를 장소 조사로 오인하는 식) 그래서 실제로 그 자리에서
   * A를 B로 바꿔 썼다는 게 차이 목록에 나타날 때만 발동시킨다.
   */
  swap?: [expected: string, actual: string]
  note: GrammarNote
}

const RULES: Rule[] = [
  {
    expected: /います|いました/,
    actual: /あります|ありました/,
    note: {
      title: 'います / あります',
      detail:
        '사람·동물처럼 스스로 움직이는 것에는 います, 사물·식물처럼 움직이지 않는 것에는 あります를 씁니다. 고양이는 동물이니 います.',
    },
  },
  {
    expected: /あります|ありました/,
    actual: /います|いました/,
    note: {
      title: 'あります / います',
      detail:
        '사물·식물에는 あります를 씁니다. います는 사람과 동물에만 씁니다. (책·가방·나무 → あります)',
    },
  },
  {
    expected: /に/,
    actual: /で/,
    swap: ['に', 'で'],
    context: /います|あります|いました|ありました|すんで|とまって/,
    note: {
      title: '장소의 に / で',
      detail:
        '무언가가 있는 장소에는 に를 씁니다. で는 그곳에서 무언가를 할 때(먹다·공부하다) 씁니다.',
    },
  },
  {
    expected: /で/,
    actual: /に/,
    swap: ['で', 'に'],
    context: /たべ|のみ|べんきょう|はたらき|あそび|みます|ききます/,
    note: {
      title: '장소의 で / に',
      detail: '동작이 일어나는 장소에는 で를 씁니다. に는 존재하는 장소나 도착점에 씁니다.',
    },
  },
  {
    expected: /が/,
    actual: /を/,
    swap: ['が', 'を'],
    context: /すき|きらい|ほしい|できます|できる|わかります|じょうず|へた/,
    note: {
      title: '好き・ほしい 앞의 조사',
      detail:
        '好き・嫌い・ほしい・できる・わかる 앞에서는 대상에 を가 아니라 が를 씁니다. (日本語が好きです)',
    },
  },
  {
    expected: /ほしい/,
    actual: /たいです|たい$/,
    note: {
      title: 'ほしい / 〜たい',
      detail:
        '물건을 원할 때는 「명사 + が ほしい」, 어떤 동작을 하고 싶을 때는 「동사 + たい」입니다.',
    },
  },
  {
    expected: /たいです|たい$/,
    actual: /ほしい/,
    note: {
      title: '〜たい / ほしい',
      detail: '동작을 하고 싶을 때는 동사에 たい를 붙입니다. ほしい는 물건을 원할 때만 씁니다.',
    },
  },
  {
    // 모범 답안에는 くて가 없는데 내 답에만 있으면 て형을 잘못 쓴 것
    actual: /くて/,
    note: {
      title: 'い형용사의 て형',
      detail:
        'い형용사가 뒤의 명사를 꾸밀 때는 기본형을 그대로 씁니다. 「冷たくて飲み物」가 아니라 「冷たい飲み物」. くて는 두 문장을 이을 때 씁니다.',
    },
  },
  {
    expected: /へ/,
    actual: /に/,
    swap: ['へ', 'に'],
    context: /いきます|きます|かえります/,
    note: {
      title: '방향의 へ / に',
      detail: '이동 방향에는 へ와 に 둘 다 쓸 수 있지만, 모범 답안은 방향을 강조하는 へ를 썼습니다.',
    },
  },
  {
    expected: /ませんか|ましょう/,
    actual: /ますか/,
    note: {
      title: '권유 표현',
      detail: '같이 하자고 권할 때는 「〜ませんか」(제안)나 「〜ましょう」(같이 하자)를 씁니다.',
    },
  },
  {
    expected: /ください/,
    actual: /ます|ました/,
    note: {
      title: '부탁 표현',
      detail: '부탁하거나 요청할 때는 동사 て형에 ください를 붙입니다. (書いてください)',
    },
  },
  {
    expected: /(ました|でした)$/,
    actual: /(ます|です)$/,
    note: {
      title: '과거형',
      detail: '지나간 일은 ます→ました, です→でした로 바꿔 씁니다.',
    },
  },
  {
    expected: /は/,
    actual: /が/,
    swap: ['は', 'が'],
    note: {
      title: 'は / が',
      detail:
        '문장 전체의 화제(무엇에 대한 이야기인지)에는 は를, 새로 등장하거나 강조하는 주어에는 が를 씁니다.',
    },
  },
  {
    expected: /が/,
    actual: /は/,
    swap: ['が', 'は'],
    note: {
      title: 'が / は',
      detail:
        '처음 등장하는 대상이나 「무엇이」에 해당하는 주어에는 が를 씁니다. は는 이미 아는 화제에 붙입니다.',
    },
  },
]

/** 한 번에 보여줄 설명 개수 — 너무 많으면 읽지 않는다 */
const MAX_NOTES = 2

/** 차이 목록에 'A를 B로 바꿔 씀'이 실제로 나타나는지 */
function hasSwap(diff: DiffOp[] | undefined, [a, b]: [string, string]): boolean {
  if (!diff) return false
  for (let i = 0; i < diff.length - 1; i++) {
    const cur = diff[i]
    const next = diff[i + 1]
    // 한 글자를 한 글자로 바꾼 자리만 인정한다.
    // 긴 구간에 우연히 섞여 있는 것까지 세면 딴 문장에도 조사 설명이 붙는다.
    if (cur.type === 'missing' && next.type === 'extra' && cur.text === a && next.text === b) {
      return true
    }
  }
  return false
}

/**
 * 조사 설명을 붙일 최소 일치도.
 * 문장이 통째로 다르면 우연히 は와 が가 같은 자리에 놓일 뿐이라
 * "조사를 헷갈렸다"는 설명이 사실이 아니게 된다.
 */
const SWAP_MIN_PERCENT = 55

interface Options {
  /** 차이 목록 — 조사 규칙이 실제 교체 위치에서만 발동하도록 */
  diff?: DiffOp[]
  /** 모범 답안과의 일치도 */
  percent?: number
}

/**
 * 모범 답안과 내 답을 견줘 해당하는 문법 설명을 찾는다.
 * 두 문자열 모두 히라가나로 정규화된 상태여야 한다.
 */
export function grammarNotes(
  expected: string,
  actual: string,
  { diff, percent = 100 }: Options = {},
): GrammarNote[] {
  const out: GrammarNote[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (out.length >= MAX_NOTES) break
    if (rule.swap) {
      // 교체 증거가 훨씬 정확하므로 '문장 어딘가에 있는지' 검사는 건너뛴다.
      // (がくせい의 が 때문에 진짜 조사 실수를 놓치던 문제)
      if (percent < SWAP_MIN_PERCENT || !hasSwap(diff, rule.swap)) continue
    } else {
      if (rule.expected && !rule.expected.test(expected)) continue
      if (!rule.actual.test(actual)) continue
      // 반대쪽에도 같은 표현이 있으면 헷갈린 게 아니다
      if (rule.actual.test(expected)) continue
      if (rule.expected && rule.expected.test(actual)) continue
    }
    if (rule.context && !rule.context.test(expected)) continue
    if (seen.has(rule.note.title)) continue
    seen.add(rule.note.title)
    out.push(rule.note)
  }
  return out
}
