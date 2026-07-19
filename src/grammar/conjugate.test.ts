import { describe, expect, it } from 'vitest'
import { conjugateIAdj, conjugateNaAdj, conjugateVerb, detectGroup } from './conjugate'

describe('detectGroup', () => {
  it('일단(2그룹): e/i단 + る', () => {
    expect(detectGroup('食べる', 'たべる')).toBe(2)
    expect(detectGroup('見る', 'みる')).toBe(2)
    expect(detectGroup('変える', 'かえる')).toBe(2)
  })

  it('오단(1그룹): る 이외 어미', () => {
    expect(detectGroup('買う', 'かう')).toBe(1)
    expect(detectGroup('書く', 'かく')).toBe(1)
    expect(detectGroup('話す', 'はなす')).toBe(1)
    expect(detectGroup('飲む', 'のむ')).toBe(1)
  })

  it('る로 끝나는 오단 예외: 帰る·入る·切る', () => {
    expect(detectGroup('帰る', 'かえる')).toBe(1)
    expect(detectGroup('入る', 'はいる')).toBe(1)
    expect(detectGroup('切る', 'きる')).toBe(1)
  })

  it('불규칙(3그룹): する·来る·복합 する', () => {
    expect(detectGroup('する', 'する')).toBe(3)
    expect(detectGroup('来る', 'くる')).toBe(3)
    expect(detectGroup('勉強する', 'べんきょうする')).toBe(3)
  })
})

describe('conjugateVerb — 오단', () => {
  it('ます형: 行く→行きます, 飲む→飲みます, 買う→買います', () => {
    expect(conjugateVerb('行く', 1, 'masu')).toBe('行きます')
    expect(conjugateVerb('飲む', 1, 'masu')).toBe('飲みます')
    expect(conjugateVerb('買う', 1, 'masu')).toBe('買います')
  })

  it('て형 규칙별: 買って/立って/帰って, 飲んで/遊んで/死んで, 書いて, 泳いで, 話して', () => {
    expect(conjugateVerb('買う', 1, 'te')).toBe('買って')
    expect(conjugateVerb('立つ', 1, 'te')).toBe('立って')
    expect(conjugateVerb('帰る', 1, 'te')).toBe('帰って')
    expect(conjugateVerb('飲む', 1, 'te')).toBe('飲んで')
    expect(conjugateVerb('遊ぶ', 1, 'te')).toBe('遊んで')
    expect(conjugateVerb('死ぬ', 1, 'te')).toBe('死んで')
    expect(conjugateVerb('書く', 1, 'te')).toBe('書いて')
    expect(conjugateVerb('泳ぐ', 1, 'te')).toBe('泳いで')
    expect(conjugateVerb('話す', 1, 'te')).toBe('話して')
  })

  it('行く의 て형 예외: 行って', () => {
    expect(conjugateVerb('行く', 1, 'te')).toBe('行って')
    expect(conjugateVerb('いく', 1, 'te')).toBe('いって')
  })

  it('た형: 飲んだ, 書いた, 行った', () => {
    expect(conjugateVerb('飲む', 1, 'ta')).toBe('飲んだ')
    expect(conjugateVerb('書く', 1, 'ta')).toBe('書いた')
    expect(conjugateVerb('行く', 1, 'ta')).toBe('行った')
  })

  it('ない형: 買う→買わない (う→わ), 書く→書かない', () => {
    expect(conjugateVerb('買う', 1, 'nai')).toBe('買わない')
    expect(conjugateVerb('書く', 1, 'nai')).toBe('書かない')
  })

  it('가능형: 書く→書ける, 飲む→飲める', () => {
    expect(conjugateVerb('書く', 1, 'potential')).toBe('書ける')
    expect(conjugateVerb('飲む', 1, 'potential')).toBe('飲める')
  })
})

describe('conjugateVerb — 일단·불규칙', () => {
  it('일단: 食べる 전 활용', () => {
    expect(conjugateVerb('食べる', 2, 'masu')).toBe('食べます')
    expect(conjugateVerb('食べる', 2, 'te')).toBe('食べて')
    expect(conjugateVerb('食べる', 2, 'ta')).toBe('食べた')
    expect(conjugateVerb('食べる', 2, 'nai')).toBe('食べない')
    expect(conjugateVerb('食べる', 2, 'potential')).toBe('食べられる')
  })

  it('する·복합동사·来る', () => {
    expect(conjugateVerb('する', 3, 'te')).toBe('して')
    expect(conjugateVerb('勉強する', 3, 'masu')).toBe('勉強します')
    expect(conjugateVerb('勉強する', 3, 'potential')).toBe('勉強できる')
    expect(conjugateVerb('来る', 3, 'te')).toBe('来て')
    expect(conjugateVerb('くる', 3, 'nai')).toBe('こない')
  })
})

describe('형용사 활용', () => {
  it('い형용사: 高い', () => {
    expect(conjugateIAdj('高い', 'negative')).toBe('高くない')
    expect(conjugateIAdj('高い', 'past')).toBe('高かった')
    expect(conjugateIAdj('高い', 'te')).toBe('高くて')
    expect(conjugateIAdj('高い', 'adverb')).toBe('高く')
  })

  it('いい는 よ 어간으로 활용', () => {
    expect(conjugateIAdj('いい', 'negative')).toBe('よくない')
    expect(conjugateIAdj('いい', 'past')).toBe('よかった')
  })

  it('な형용사: 静か', () => {
    expect(conjugateNaAdj('静か', 'negative')).toBe('静かじゃない')
    expect(conjugateNaAdj('静か', 'past')).toBe('静かだった')
    expect(conjugateNaAdj('静か', 'adverb')).toBe('静かに')
  })
})
