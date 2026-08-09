import { describe, expect, it } from 'vitest'
import { exampleSpeechText, parseFurigana, stripFurigana } from './furigana'

describe('furigana', () => {
  it('마크업을 한자 덩어리와 읽기로 분해한다', () => {
    expect(parseFurigana('ドアが開(あ)きました。')).toEqual([
      { text: 'ドアが' },
      { text: '開', reading: 'あ' },
      { text: 'きました。' },
    ])
  })

  it('후리가나를 걷어내면 원문이 그대로 복원된다', () => {
    expect(stripFurigana('今年(ことし)の夏(なつ)は暑(あつ)いです。')).toBe('今年の夏は暑いです。')
  })

  describe('exampleSpeechText', () => {
    it('표제어 한자만 가나로 바꿔 카드와 발음을 맞춘다', () => {
      // 開く=あく 카드인데 음성엔진이 「ひらきました」로 읽는 문제를 막는다
      expect(exampleSpeechText('ドアが開きました。', 'ドアが開(あ)きました。', '開く')).toBe(
        'ドアがあきました。',
      )
    })

    it('표제어와 무관한 한자는 그대로 둔다', () => {
      expect(
        exampleSpeechText('今年の夏は暑いです。', '今年(ことし)の夏(なつ)は暑(あつ)いです。', '今年'),
      ).toBe('ことしの夏は暑いです。')
    })

    it('후리가나가 없으면 원문을 그대로 읽는다', () => {
      expect(exampleSpeechText('ドアが開きました。', undefined, '開く')).toBe('ドアが開きました。')
    })
  })
})
