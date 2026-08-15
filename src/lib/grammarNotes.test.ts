import { describe, expect, it } from 'vitest'
import { diffChars, scoreCompose } from './compose'
import { grammarNotes } from './grammarNotes'

/** 실제 화면과 같은 조건 — 차이 목록과 일치도까지 함께 넘긴다 */
const notesFor = (expected: string, actual: string) =>
  grammarNotes(expected, actual, {
    diff: diffChars(expected, actual),
    percent: scoreCompose(actual, expected, expected).percent,
  })

/** 두 문장은 모두 히라가나로 정규화된 상태로 들어온다 */
describe('grammarNotes', () => {
  it('います를 あります로 쓴 경우를 짚어 준다', () => {
    const notes = notesFor('つくえのしたにねこがいます', 'つくえのしたにねこがあります')
    expect(notes[0].title).toBe('います / あります')
    expect(notes[0].detail).toContain('사람·동물')
  })

  it('あります를 います로 쓴 경우도 짚어 준다', () => {
    const notes = notesFor('つくえのうえにほんがあります', 'つくえのうえにほんがいます')
    expect(notes[0].title).toBe('あります / います')
  })

  it('い형용사를 て형으로 잘못 쓴 경우를 알려준다', () => {
    const notes = notesFor('つめたいのみものをのみたいです', 'つめたくてのみものをのみたいです')
    expect(notes.some((n) => n.title === 'い형용사의 て형')).toBe(true)
  })

  it('好き 앞의 조사를 を로 쓴 경우를 알려준다', () => {
    const notes = notesFor('にほんごがすきです', 'にほんごをすきです')
    expect(notes[0].title).toBe('好き・ほしい 앞의 조사')
  })

  it('과거형을 현재형으로 쓴 경우를 알려준다', () => {
    const notes = notesFor('きのうえいがをみました', 'きのうえいがをみます')
    expect(notes.some((n) => n.title === '과거형')).toBe(true)
  })

  it('같은 표현이 양쪽에 다 있으면 설명하지 않는다', () => {
    // 둘 다 います를 썼으니 います/あります를 헷갈린 게 아니다
    const notes = notesFor('へやにねこがいます', 'にわにねこがいます')
    expect(notes.some((n) => n.title.includes('あります'))).toBe(false)
  })

  it('정답과 같은 문장에는 아무 설명도 붙지 않는다', () => {
    expect(notesFor('わたしはがくせいです', 'わたしはがくせいです')).toEqual([])
  })

  it('です의 で를 장소 조사로 오인하지 않는다', () => {
    // 전혀 다른 문장이라도 で가 です 안에 들어 있을 뿐이면 조사 설명이 붙으면 안 된다
    const notes = notesFor('つくえのうえにほんがあります', 'つめたくてのみものをのみたいです')
    expect(notes.some((n) => n.title.includes('장소의'))).toBe(false)
  })

  it('문장이 통째로 다르면 조사 설명을 붙이지 않는다', () => {
    // 우연히 は와 が가 같은 자리에 정렬됐을 뿐 조사를 헷갈린 게 아니다
    const notes = notesFor('はなはきれいです', 'がっこうがおおきいです')
    expect(notes.some((n) => n.title === 'は / が' || n.title === 'が / は')).toBe(false)
  })

  it('문장이 거의 맞을 때는 조사 설명을 붙인다', () => {
    const notes = notesFor('わたしはがくせいです', 'わたしががくせいです')
    expect(notes.some((n) => n.title === 'は / が')).toBe(true)
  })

  it('설명은 최대 2개까지만 준다', () => {
    const notes = notesFor('つくえのしたにねこがいます', 'つくえのうえでねこがありました')
    expect(notes.length).toBeLessThanOrEqual(2)
  })
})
