import { describe, expect, it } from 'vitest'
import { COMPOSE_PASS, composeHints, diffChars, normalizeSentence, scoreCompose } from './compose'

const KANA = 'ドアがあきました。'
const KANJI = 'ドアが開きました。'

describe('normalizeSentence', () => {
  it('로마자를 히라가나로 바꾸고 부호를 무시한다', () => {
    expect(normalizeSentence('doaga akimashita.')).toBe('どあがあきました')
  })

  it('가타카나도 히라가나로 통일한다', () => {
    expect(normalizeSentence(KANA)).toBe('どあがあきました')
  })

  it('띄어쓰기는 로마자 변환 뒤에 지운다 (hon o → ほんお, ほの 아님)', () => {
    expect(normalizeSentence('hon o yomimasu')).toBe('ほんおよみます')
  })

  it('장음은 발음의 일부라 지우지 않는다', () => {
    // コーヒー가 「こひ」로 뭉개지면 로마자 입력과 절대 맞지 않는다
    expect(normalizeSentence('コーヒーをのみます')).toBe('こうひいをのみます')
  })
})

describe('scoreCompose', () => {
  it('로마자로 정확히 쓰면 100%', () => {
    const r = scoreCompose('doaga akimashita', KANA, KANJI)
    expect(r.percent).toBe(100)
    expect(r.correct).toBe(true)
    expect(r.matched).toBe('kana')
  })

  it('히라가나로 써도 100% (한자를 몰라도 정답)', () => {
    expect(scoreCompose('どあがあきました', KANA, KANJI).percent).toBe(100)
  })

  it('일본어 키보드로 한자를 직접 쓴 경우도 정답', () => {
    const r = scoreCompose('ドアが開きました。', KANA, KANJI)
    expect(r.percent).toBe(100)
    expect(r.matched).toBe('kanji')
  })

  it('한 글자 틀리면 100% 미만이지만 통과선은 넘는다', () => {
    const r = scoreCompose('どあがあきました', 'どあがあきましたよ', 'ドアが開きましたよ')
    expect(r.percent).toBeGreaterThanOrEqual(88)
    expect(r.percent).toBeLessThan(100)
  })

  it('조사만 틀리면 감점이 절반이라 통과선을 넘는다', () => {
    // を/が 를 헷갈린 것과 문장을 통째로 다르게 쓴 것을 같게 볼 수 없다
    const r = scoreCompose('わたしをがくせいです', 'わたしはがくせいです', '私は学生です')
    expect(r.correct).toBe(true)
    expect(r.percent).toBeGreaterThan(90)
  })

  it('내용어가 틀리면 조사보다 크게 감점된다', () => {
    const particle = scoreCompose('わたしをがくせいです', 'わたしはがくせいです', '私は学生です')
    const content = scoreCompose('わたしはがくせんです', 'わたしはがくせいです', '私は学生です')
    expect(content.percent).toBeLessThan(particle.percent)
  })

  it('활용만 틀린 문장은 통과선을 넘는다 (冷たくて → 冷たい)', () => {
    const r = scoreCompose(
      'つめたくてのみものをのみたいです',
      'つめたいのみものをのみたいです',
      '冷たい飲み物を飲みたいです',
    )
    expect(r.percent).toBeGreaterThanOrEqual(COMPOSE_PASS)
    expect(r.correct).toBe(true)
  })

  it('전혀 다른 문장은 낮은 점수와 오답', () => {
    const r = scoreCompose('わたしはがくせいです', KANA, KANJI)
    expect(r.correct).toBe(false)
    expect(r.percent).toBeLessThan(60)
  })

  it('가나로만 쓴 오답은 가나 기준으로 지적한다 (한자가 튀어나오지 않게)', () => {
    // 한자 정답과 비교하면 정답의 한자가 전부 "빠뜨린 글자"로 표시돼 쓸모없는 피드백이 된다
    const r = scoreCompose('わたしはがくせいです', KANA, KANJI)
    expect(r.matched).toBe('kana')
    expect(r.diff.some((op) => /[一-鿿]/.test(op.text))).toBe(false)
  })

  it('빈 입력은 0%', () => {
    expect(scoreCompose('', KANA, KANJI).percent).toBe(0)
  })
})

describe('diffChars', () => {
  it('빠뜨린 글자와 잘못 쓴 글자를 구분한다', () => {
    expect(diffChars('あきました', 'あけました')).toEqual([
      { type: 'same', text: 'あ' },
      { type: 'missing', text: 'き' },
      { type: 'extra', text: 'け' },
      { type: 'same', text: 'ました' },
    ])
  })

  it('글자가 모자라면 missing 으로만 남는다', () => {
    expect(diffChars('あきました', 'あき')).toEqual([
      { type: 'same', text: 'あき' },
      { type: 'missing', text: 'ました' },
    ])
  })

  it('완전히 같으면 same 하나', () => {
    expect(diffChars('あきました', 'あきました')).toEqual([{ type: 'same', text: 'あきました' }])
  })
})

describe('composeHints', () => {
  it('조사를 바꿔 쓴 것은 조사 문제로 알려준다', () => {
    const hints = composeHints(diffChars('わたしはがくせい', 'わたしをがくせい'))
    expect(hints[0]).toBe('조사가 달라요 — を 대신 は 를 써요')
  })

  it('빠뜨린 조사를 짚어 준다', () => {
    const hints = composeHints(diffChars('ほんをよみます', 'ほんよみます'))
    expect(hints[0]).toBe('조사 を 가 빠졌어요')
  })

  it('최대 3개까지만 알려준다', () => {
    expect(composeHints(diffChars('あいうえおかきくけこ', 'さしすせそたちつてと')).length).toBeLessThanOrEqual(3)
  })
})
