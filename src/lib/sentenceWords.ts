import type { Card } from '../db/schema'
import { parseFurigana } from './furigana'

/**
 * 예문에 쓰인 단어를 단어장에서 찾아 뜻을 붙인다.
 *
 * 오프라인이라 형태소 분석기를 쓸 수 없다. 대신 후리가나가 알려주는
 * 한자 덩어리를 단서로 삼아 단어장을 뒤진다. 뜻을 잘못 붙이면 안 배우느니만
 * 못하므로, 확실히 맞는 경우에만 붙이고 애매하면 그냥 넘어간다.
 */

export interface SentenceWord {
  cardId: string
  deckId: string
  kanji: string
  kana: string
  ko: string
  pos?: string
}

const KANJI_RUN = /[一-鿿々〆ヵヶ]+/g
const NUMERAL = /^[一二三四五六七八九十百千万〇0-9]+(.+)$/

/** "A; B" 표제어의 첫 변형 */
function first(kanji: string): string {
  return kanji.split(';')[0].trim()
}

export interface WordIndex {
  /** 표제어 그대로 */
  exact: Map<string, Card>
  /** 표제어의 앞 한자 덩어리 → 카드들 (洗 → 洗う 처럼 활용형 대응) */
  stem: Map<string, Card[]>
  /** 가나로만 된 단어 (とても, ゆっくり …) */
  kanaOnly: Card[]
}

export function buildWordIndex(cards: Card[]): WordIndex {
  const exact = new Map<string, Card>()
  const stem = new Map<string, Card[]>()
  const kanaOnly: Card[] = []
  for (const c of cards) {
    // 문형 카드(〜てください)는 문장 안에서 표제어로 잡히지 않는다
    if (c.pos === '문형') continue
    const k = first(c.kanji)
    if (!exact.has(k)) exact.set(k, c)
    const head = k.match(/^[一-鿿々〆ヵヶ]+/)?.[0]
    if (head) {
      const list = stem.get(head) ?? []
      list.push(c)
      stem.set(head, list)
    } else if (k.length >= 2 && k === c.kana) {
      kanaOnly.push(c)
    }
  }
  // 짧은 표제어부터 맞춰야 洗 → 洗う 처럼 가장 가까운 단어가 잡힌다
  for (const list of stem.values()) list.sort((a, b) => first(a.kanji).length - first(b.kanji).length)
  kanaOnly.sort((a, b) => b.kana.length - a.kana.length)
  return { exact, stem, kanaOnly }
}

/**
 * 한자 뒤에 오는 글자가 활용 어미면 그 자리는 동사·형용사다.
 * 遊びます의 遊를 명사 「遊び」로 잡지 않기 위한 판별.
 */
const INFLECTED = /^[ぁ-ん]{0,2}(ます|まし|ませ|たい|たく|ました|なかった|ない)/

const CONJUGATABLE = /동사|형용사/

/** 한자 덩어리 하나를 단어장에서 찾는다. after는 문장에서 그 뒤에 오는 글자들. */
function lookupChunk(chunk: string, after: string, idx: WordIndex): Card | undefined {
  // 표제어가 이 한자로 시작하는 후보를 모두 모은다.
  // 정확히 일치하는 것을 곧바로 쓰면 子どもたち에서 「子」에 걸려 「子ども」를 놓친다.
  const cands = idx.stem.get(chunk) ?? []
  if (cands.length === 0) {
    const exact = idx.exact.get(chunk)
    if (exact) return exact
    // お茶 · ご飯 처럼 존경 접두어가 붙은 표제어
    for (const prefix of ['お', 'ご']) {
      const withPrefix = idx.exact.get(prefix + chunk)
      if (withPrefix) return withPrefix
    }
    // 七時 · 二階 처럼 수사 + 조수사
    const counter = chunk.match(NUMERAL)?.[1]
    if (counter) return idx.exact.get('～' + counter) ?? idx.exact.get(counter)
    return undefined
  }
  // 활용 어미가 따라오면 동사·형용사 쪽을 고른다 (遊びます → 遊び(명사)가 아니라 遊ぶ)
  const pool = INFLECTED.test(after)
    ? cands.filter((c) => c.pos && CONJUGATABLE.test(c.pos))
    : cands
  const usable = pool.length ? pool : cands
  const surface = chunk + after
  let best = usable[0]
  let bestScore = -1
  for (const c of usable) {
    const k = first(c.kanji)
    // 문장에 표제어가 그대로 나타나면 가장 확실하다 (子どもたち → 子ども)
    const exactLen = surface.startsWith(k) ? k.length * 10 : 0
    // 아니면 오쿠리가나가 얼마나 겹치는지로 가른다.
    // 始まります의 始는 「始める」(める)가 아니라 「始まる」(まる) 쪽이다.
    const okurigana = k.slice(chunk.length)
    let shared = 0
    while (shared < okurigana.length && okurigana[shared] === after[shared]) shared++
    const score = exactLen + shared
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/**
 * 예문에 나온 단어 목록. 문장에 나온 순서를 지키고 같은 단어는 한 번만 담는다.
 * @param marked 후리가나 마크업 예문 (없으면 plain에서 한자 덩어리를 뽑는다)
 */
export function lookupSentenceWords(
  marked: string | undefined,
  plain: string,
  idx: WordIndex,
  skipCardId?: string,
): SentenceWord[] {
  // 각 한자 덩어리와 '그 뒤에 오는 글자들'을 함께 모은다.
  // 뒤 글자를 봐야 활용형인지 알 수 있어 품사를 제대로 고를 수 있다.
  const chunks: { text: string; after: string }[] = []
  if (marked) {
    const segs = parseFurigana(marked)
    segs.forEach((seg, i) => {
      if (!seg.readings) return
      chunks.push({
        text: seg.text,
        after: segs.slice(i + 1).map((s) => s.text).join(''),
      })
    })
  } else {
    for (const m of plain.matchAll(KANJI_RUN)) {
      chunks.push({ text: m[0], after: plain.slice((m.index ?? 0) + m[0].length) })
    }
  }

  const out: SentenceWord[] = []
  const seen = new Set<string>()
  const push = (c: Card) => {
    if (c.id === skipCardId || seen.has(c.id)) return
    seen.add(c.id)
    out.push({
      cardId: c.id,
      deckId: c.deckId,
      kanji: first(c.kanji),
      kana: c.kana,
      ko: c.ko,
      pos: c.pos,
    })
  }

  for (const chunk of chunks) {
    const c = lookupChunk(chunk.text, chunk.after, idx)
    if (c) push(c)
  }

  // 가나로만 된 단어도 훑는다 (とても · ゆっくり). 긴 것부터 맞춰 겹침을 막는다
  let rest = plain
  for (const c of idx.kanaOnly) {
    if (rest.includes(c.kana)) {
      push(c)
      rest = rest.split(c.kana).join('')
    }
  }

  return out
}
