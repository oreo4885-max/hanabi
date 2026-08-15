import { describe, expect, it } from 'vitest'
import type { Card } from '../db/schema'
import { buildWordIndex, lookupSentenceWords } from './sentenceWords'

function card(id: string, kanji: string, kana: string, ko: string, pos = '명사'): Card {
  return { id, deckId: 'jlpt-n5', kanji, kana, ko, pos } as Card
}

const CARDS: Card[] = [
  card('w1', '毎朝', 'まいあさ', '매일 아침'),
  card('w2', '顔', 'かお', '얼굴'),
  card('w3', '洗う', 'あらう', '씻다', '동사'),
  card('w4', 'お茶', 'おちゃ', '차'),
  card('w5', '～時', 'じ', '~시'),
  card('w6', 'とても', 'とても', '매우, 아주', '부사'),
  card('w7', '飲む', 'のむ', '마시다', '동사'),
  card('g1', '〜てください', 'てください', '~해 주세요', '문형'),
]
const IDX = buildWordIndex(CARDS)

describe('lookupSentenceWords', () => {
  it('후리가나가 짚어 준 한자 덩어리로 단어를 찾는다', () => {
    const words = lookupSentenceWords('毎朝(まい|あさ)顔(かお)を洗(あら)います。', '毎朝顔を洗います。', IDX)
    expect(words.map((w) => w.kanji)).toEqual(['毎朝', '顔', '洗う'])
  })

  it('활용형이라 표제어와 끝이 달라도 찾는다 (洗います → 洗う)', () => {
    const words = lookupSentenceWords('洗(あら)います。', '洗います。', IDX)
    expect(words[0].ko).toBe('씻다')
  })

  it('존경 접두어가 붙은 표제어를 찾는다 (茶 → お茶)', () => {
    const words = lookupSentenceWords('お茶(ちゃ)を飲(の)みます。', 'お茶を飲みます。', IDX)
    expect(words.map((w) => w.kanji)).toContain('お茶')
  })

  it('수사 + 조수사를 조수사 카드로 찾는다 (七時 → ～時)', () => {
    const words = lookupSentenceWords('七時(しち|じ)に。', '七時に。', IDX)
    expect(words.map((w) => w.kanji)).toContain('～時')
  })

  it('가나로만 된 단어도 찾는다', () => {
    const words = lookupSentenceWords('とても顔(かお)が。', 'とても顔が。', IDX)
    expect(words.map((w) => w.kanji)).toContain('とても')
  })

  it('이미 화면에 보여 준 핵심 단어는 빼고 준다', () => {
    const words = lookupSentenceWords('顔(かお)を洗(あら)います。', '顔を洗います。', IDX, 'w2')
    expect(words.map((w) => w.cardId)).not.toContain('w2')
  })

  it('문형 카드는 단어 목록에 넣지 않는다', () => {
    const words = lookupSentenceWords('顔(かお)を洗(あら)ってください。', '顔を洗ってください。', IDX)
    expect(words.map((w) => w.cardId)).not.toContain('g1')
  })

  it('같은 단어가 두 번 나와도 한 번만 담는다', () => {
    const words = lookupSentenceWords('顔(かお)と顔(かお)。', '顔と顔。', IDX)
    expect(words.filter((w) => w.cardId === 'w2')).toHaveLength(1)
  })

  it('활용 어미가 따라오면 동사를 고른다 (遊びます → 遊ぶ, 遊び 아님)', () => {
    const cards = [
      card('v', '遊ぶ', 'あそぶ', '놀다', '동사'),
      card('n', '遊び', 'あそび', '놀이', '명사'),
    ]
    const idx = buildWordIndex(cards)
    const words = lookupSentenceWords('遊(あそ)びます。', '遊びます。', idx)
    expect(words[0].kanji).toBe('遊ぶ')
  })

  it('활용이 아니면 문장에 그대로 나온 명사를 고른다', () => {
    const cards = [
      card('v', '遊ぶ', 'あそぶ', '놀다', '동사'),
      card('n', '遊び', 'あそび', '놀이', '명사'),
    ]
    const idx = buildWordIndex(cards)
    const words = lookupSentenceWords('遊(あそ)びが好き。', '遊びが好き。', idx)
    expect(words[0].kanji).toBe('遊び')
  })

  it('문장에 그대로 나오는 더 긴 표제어를 고른다 (子 → 子ども)', () => {
    const cards = [card('a', '子', 'こ', '아이'), card('b', '子ども', 'こども', '어린이')]
    const idx = buildWordIndex(cards)
    const words = lookupSentenceWords('子(こ)どもたち。', '子どもたち。', idx)
    expect(words[0].kanji).toBe('子ども')
  })

  it('오쿠리가나로 자동사·타동사를 가른다 (始まります → 始まる)', () => {
    const cards = [
      card('t', '始める', 'はじめる', '시작하다', '동사'),
      card('i', '始まる', 'はじまる', '시작되다', '동사'),
    ]
    const idx = buildWordIndex(cards)
    const words = lookupSentenceWords('年(とし)が始(はじ)まります。', '年が始まります。', idx)
    expect(words[0].kanji).toBe('始まる')
  })

  it('찾지 못한 한자는 조용히 넘어간다', () => {
    const words = lookupSentenceWords('田中(た|なか)さんです。', '田中さんです。', IDX)
    expect(words).toEqual([])
  })
})
