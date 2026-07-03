import { toHiragana } from 'wanakana'

/**
 * 답안 정규화: NFKC(전각→반각 등) → 공백 제거 → 히라가나 통일.
 * wanakana.toHiragana는 가타카나와 로마자 입력을 모두 히라가나로 변환한다.
 */
export function normalizeAnswer(input: string): string {
  const cleaned = input.normalize('NFKC').replace(/\s+/g, '')
  if (!cleaned) return ''
  return toHiragana(cleaned)
}

/** 사용자가 입력한 읽기가 정답 kana와 일치하는지 (히라가나/가타카나/로마자 허용) */
export function isCorrectKana(input: string, expected: string): boolean {
  const a = normalizeAnswer(input)
  if (!a) return false
  return a === normalizeAnswer(expected)
}
