import { describe, expect, it } from 'vitest'
import type { Card } from '../../db/schema'
import { pickDistractors } from './generate'

function card(id: string, kanji: string, kana: string, ko: string, pos = '명사'): Card {
  return { id, deckId: 'jlpt-n5', kanji, kana, ko, pos } as Card
}

const TARGET = card('t', '会う', 'あう', '만나다', '동사')

const POOL: Card[] = [
  TARGET,
  // 형태가 닮음 — 같은 한자 또는 비슷한 발음
  card('a', '合う', 'あう', '맞다, 일치하다', '동사'),
  card('b', '会社', 'かいしゃ', '회사'),
  card('c', '洗う', 'あらう', '씻다', '동사'),
  // 뜻이 닮음
  card('d', '待つ', 'まつ', '기다리다', '동사'),
  // 전혀 무관 — 쉬운 보기
  card('x', '牛肉', 'ぎゅうにく', '소고기'),
  card('y', '飛行機', 'ひこうき', '비행기'),
  card('z', '図書館', 'としょかん', '도서관'),
]

describe('pickDistractors', () => {
  it('정답과 형태가 닮은 보기를 우선한다 (단어 고르기)', () => {
    const picked = pickDistractors(TARGET, POOL, false, 3)
    const ids = picked.map((c) => c.id)
    // 무관한 단어만으로 채워지면 소거법으로 풀려버린다
    expect(ids.some((id) => ['a', 'b', 'c'].includes(id))).toBe(true)
  })

  it('정답 자신은 보기에 넣지 않는다', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickDistractors(TARGET, POOL, true, 3).some((c) => c.id === TARGET.id)).toBe(false)
    }
  })

  it('뜻이 같은 단어는 오답 보기에서 제외한다', () => {
    const pool = [TARGET, card('same', '逢う', 'あう', '만나다', '동사'), ...POOL.slice(1)]
    for (let i = 0; i < 20; i++) {
      expect(pickDistractors(TARGET, pool, true, 3).some((c) => c.id === 'same')).toBe(false)
    }
  })

  it('요청한 개수만큼 뽑는다', () => {
    expect(pickDistractors(TARGET, POOL, true, 3)).toHaveLength(3)
  })

  it('후보가 모자라면 있는 만큼만 뽑는다', () => {
    const tiny = [TARGET, POOL[1]]
    expect(pickDistractors(TARGET, tiny, true, 3)).toHaveLength(1)
  })
})
