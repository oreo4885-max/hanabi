/** 일본어 활용 엔진 — 사전형(원형) 문자열을 받아 각 활용형을 돌려주는 순수 함수들 */

export type VerbGroup = 1 | 2 | 3 // 1: 오단(五段), 2: 일단(一段), 3: 불규칙

/** る로 끝나지만 1그룹(오단)인 대표 예외 동사 — 한자 표기 기준 */
const GODAN_RU_EXCEPTIONS = new Set([
  '帰る', '入る', '走る', '要る', '切る', '知る', '喋る', '滑る', '蹴る',
  '限る', '握る', '参る', '交じる', '混じる', '焦る', '減る', '照る', '散る',
])

/** 오단 활용용 행(行) 매핑 */
const A_ROW: Record<string, string> = { う: 'わ', く: 'か', ぐ: 'が', す: 'さ', つ: 'た', ぬ: 'な', ぶ: 'ば', む: 'ま', る: 'ら' }
const I_ROW: Record<string, string> = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' }
const E_ROW: Record<string, string> = { う: 'え', く: 'け', ぐ: 'げ', す: 'せ', つ: 'て', ぬ: 'ね', ぶ: 'べ', む: 'め', る: 'れ' }

const ICHIDAN_ENDINGS = /[いきぎしじちにひびみりえけげせぜてでねへべめれ]る$/

/**
 * 동사 그룹 판별. kanji(표기형)와 kana(읽기)를 함께 사용.
 * 판별이 불확실한 동사는 드릴 풀에서 제외하는 것을 전제로 한다.
 */
export function detectGroup(kanji: string, kana: string): VerbGroup {
  if (kanji === '来る' || kana === 'くる') return 3
  if (kanji.endsWith('する') || kana.endsWith('する')) return 3
  if (GODAN_RU_EXCEPTIONS.has(kanji)) return 1
  if (kana.endsWith('る') && ICHIDAN_ENDINGS.test(kana)) return 2
  return 1
}

export type VerbForm = 'masu' | 'te' | 'ta' | 'nai' | 'potential'

export const FORM_LABELS: Record<VerbForm, string> = {
  masu: 'ます형',
  te: 'て형',
  ta: 'た형',
  nai: 'ない형',
  potential: '가능형',
}

/** 오단 て형: う/つ/る→って, む/ぶ/ぬ→んで, く→いて(行く 예외), ぐ→いで, す→して */
function godanTe(stemless: string, last: string, isIku: boolean): string {
  if (isIku) return stemless + 'って'
  switch (last) {
    case 'う': case 'つ': case 'る': return stemless + 'って'
    case 'む': case 'ぶ': case 'ぬ': return stemless + 'んで'
    case 'く': return stemless + 'いて'
    case 'ぐ': return stemless + 'いで'
    case 'す': return stemless + 'して'
    default: return stemless + 'って'
  }
}

/**
 * 동사 활용. word는 한자 표기형이든 가나형이든 동일하게 동작한다
 * (활용은 마지막 오쿠리가나에서 일어나므로).
 */
export function conjugateVerb(word: string, group: VerbGroup, form: VerbForm): string {
  // 불규칙
  if (group === 3) {
    if (word === '来る') {
      return { masu: '来ます', te: '来て', ta: '来た', nai: '来ない', potential: '来られる' }[form]
    }
    if (word === 'くる') {
      return { masu: 'きます', te: 'きて', ta: 'きた', nai: 'こない', potential: 'こられる' }[form]
    }
    // 〜する 복합동사
    const stem = word.slice(0, -2)
    return {
      masu: stem + 'します',
      te: stem + 'して',
      ta: stem + 'した',
      nai: stem + 'しない',
      potential: stem + 'できる',
    }[form]
  }

  const last = word.slice(-1)
  const stemless = word.slice(0, -1)

  if (group === 2) {
    return {
      masu: stemless + 'ます',
      te: stemless + 'て',
      ta: stemless + 'た',
      nai: stemless + 'ない',
      potential: stemless + 'られる',
    }[form]
  }

  // 오단
  const isIku = word === '行く' || word === 'いく' || word.endsWith('行く')
  switch (form) {
    case 'masu': return stemless + I_ROW[last] + 'ます'
    case 'te': return godanTe(stemless, last, isIku)
    case 'ta': return godanTe(stemless, last, isIku).replace(/て$/, 'た').replace(/で$/, 'だ')
    case 'nai': return stemless + A_ROW[last] + 'ない'
    case 'potential': return stemless + E_ROW[last] + 'る'
  }
}

export type AdjForm = 'negative' | 'past' | 'te' | 'adverb'

export const I_ADJ_FORM_LABELS: Record<AdjForm, string> = {
  negative: '부정 (〜くない)',
  past: '과거 (〜かった)',
  te: 'て형 (〜くて)',
  adverb: '부사 (〜く)',
}

/** い형용사 활용. いい/良い는 よい 어간으로 활용하는 예외. */
export function conjugateIAdj(word: string, form: AdjForm): string {
  let stem = word.slice(0, -1)
  if (word === 'いい' || word === '良い' || word === 'よい') stem = word === '良い' ? '良' : 'よ'
  return {
    negative: stem + 'くない',
    past: stem + 'かった',
    te: stem + 'くて',
    adverb: stem + 'く',
  }[form]
}

export type NaAdjForm = 'negative' | 'past' | 'te' | 'adverb'

export const NA_ADJ_FORM_LABELS: Record<NaAdjForm, string> = {
  negative: '부정 (〜じゃない)',
  past: '과거 (〜だった)',
  te: 'て형 (〜で)',
  adverb: '부사 (〜に)',
}

/** な형용사(명사 술어 포함) 활용 */
export function conjugateNaAdj(word: string, form: NaAdjForm): string {
  return {
    negative: word + 'じゃない',
    past: word + 'だった',
    te: word + 'で',
    adverb: word + 'に',
  }[form]
}
