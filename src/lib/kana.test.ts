import { describe, expect, it } from 'vitest'
import { isCorrectKana, normalizeAnswer } from './kana'

describe('normalizeAnswer', () => {
  it('가타카나 → 히라가나', () => {
    expect(normalizeAnswer('ガッコウ')).toBe('がっこう')
  })

  it('로마자 → 히라가나', () => {
    expect(normalizeAnswer('gakkou')).toBe('がっこう')
  })

  it('공백(전각 포함) 제거', () => {
    expect(normalizeAnswer(' が っこ　う ')).toBe('がっこう')
  })

  it('빈 문자열 → 빈 문자열', () => {
    expect(normalizeAnswer('   ')).toBe('')
  })
})

describe('isCorrectKana', () => {
  it('동일 히라가나 정답', () => {
    expect(isCorrectKana('あう', 'あう')).toBe(true)
  })

  it('가타카나 입력도 정답 처리', () => {
    expect(isCorrectKana('アウ', 'あう')).toBe(true)
  })

  it('로마자 입력도 정답 처리', () => {
    expect(isCorrectKana('au', 'あう')).toBe(true)
  })

  it('촉음·장음 로마자', () => {
    expect(isCorrectKana('kippu', 'きっぷ')).toBe(true)
    expect(isCorrectKana('gyuunyuu', 'ぎゅうにゅう')).toBe(true)
  })

  it('가타카나 정답 단어도 히라가나/로마자 입력 허용', () => {
    expect(isCorrectKana('てれび', 'テレビ')).toBe(true)
    expect(isCorrectKana('terebi', 'テレビ')).toBe(true)
  })

  it('오답', () => {
    expect(isCorrectKana('あえ', 'あう')).toBe(false)
  })

  it('빈 입력은 오답', () => {
    expect(isCorrectKana('', 'あう')).toBe(false)
    expect(isCorrectKana('  ', 'あう')).toBe(false)
  })
})
