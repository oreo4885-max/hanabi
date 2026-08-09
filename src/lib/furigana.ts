/** `会(あ)います` 형태의 후리가나 마크업 파싱 유틸 */

export interface Segment {
  text: string
  reading?: string
}

export const RUBY_RE = /([一-鿿々〆ヵヶ]+)\(([ぁ-んー]+)\)/g

export function parseFurigana(marked: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of marked.matchAll(RUBY_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ text: marked.slice(last, idx) })
    out.push({ text: m[1], reading: m[2] })
    last = idx + m[0].length
  }
  if (last < marked.length) out.push({ text: marked.slice(last) })
  return out
}

/** 마크업에서 후리가나를 걷어낸 원문 (TTS·검증용) */
export function stripFurigana(marked: string): string {
  return marked.replace(RUBY_RE, '$1')
}

/**
 * 예문을 TTS에 넘길 문자열로 변환한다.
 *
 * 음성엔진은 여러 훈을 가진 한자를 자주 잘못 읽는다.
 * (예: 開く=あく 카드인데 예문 '開きました'를 「ひらきました」로 읽음)
 * 그래서 표제어에 해당하는 한자만 후리가나 읽기로 치환해 카드와 발음을 맞춘다.
 * 나머지 한자는 그대로 둬서 조사·억양이 어색해지지 않게 한다.
 */
export function speakableExample(card: {
  exJa?: string
  exFuri?: string
  kanji: string
}): string {
  return exampleSpeechText(card.exJa ?? '', card.exFuri, card.kanji)
}

export function exampleSpeechText(plain: string, marked?: string, headword?: string): string {
  if (!marked || !headword) return plain
  const head = headword.trim()
  return parseFurigana(marked)
    .map((seg) => {
      if (!seg.reading) return seg.text
      // 표제어에 들어 있는 한자 덩어리만 가나로 읽힌다
      return head.includes(seg.text) ? seg.reading : seg.text
    })
    .join('')
}
