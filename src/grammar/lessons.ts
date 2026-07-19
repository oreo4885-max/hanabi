export type DrillKind = 'group' | 'masu' | 'te' | 'ta' | 'nai' | 'potential' | 'iadj' | 'naadj' | 'none'

export interface Lesson {
  id: string
  level: 'N5' | 'N4'
  title: string
  /** 한국어 학습자를 위한 핵심 요령 */
  tip: string
  rows: { rule: string; example: string }[]
  drill: DrillKind
}

export const LESSONS: Lesson[] = [
  {
    id: 'group',
    level: 'N5',
    title: '동사 3그룹 판별',
    tip: '활용의 출발점. る 앞이 e/i단이면 대부분 2그룹, 나머지는 1그룹, する·来る는 3그룹.',
    rows: [
      { rule: '1그룹(오단): う·く·す·つ·ぬ·ぶ·む·ぐ·る로 끝', example: '買う, 書く, 飲む, 帰る(예외)' },
      { rule: '2그룹(일단): e단/i단 + る', example: '食べる, 見る, 起きる' },
      { rule: '3그룹(불규칙): する, 来る', example: '勉強する, 来る' },
      { rule: '주의: る로 끝나도 1그룹인 예외', example: '帰る, 入る, 走る, 切る, 知る' },
    ],
    drill: 'group',
  },
  {
    id: 'masu',
    level: 'N5',
    title: 'ます형 (정중형)',
    tip: '한국어 "~합니다"에 해당. 1그룹은 어미를 i단으로 바꾸고 +ます.',
    rows: [
      { rule: '1그룹: 어미 → i단 + ます', example: '買う→買います, 書く→書きます' },
      { rule: '2그룹: る 떼고 + ます', example: '食べる→食べます' },
      { rule: '3그룹: します / 来ます', example: '勉強する→勉強します' },
    ],
    drill: 'masu',
  },
  {
    id: 'te',
    level: 'N5',
    title: 'て형 ⭐ 최중요',
    tip: '"~하고/~해서". 〜てください·〜ている·〜てもいい가 전부 여기서 나옵니다. 리듬으로 외우세요: うつる→って, むぶぬ→んで, く→いて, ぐ→いで, す→して.',
    rows: [
      { rule: '1그룹 う・つ・る → って', example: '買う→買って, 立つ→立って, 帰る→帰って' },
      { rule: '1그룹 む・ぶ・ぬ → んで', example: '飲む→飲んで, 遊ぶ→遊んで' },
      { rule: '1그룹 く→いて / ぐ→いで / す→して', example: '書く→書いて, 泳ぐ→泳いで, 話す→話して' },
      { rule: '예외: 行く → 行って', example: '学校に行って…' },
      { rule: '2그룹: る 떼고 + て', example: '食べる→食べて' },
      { rule: '3그룹: して / 来て', example: '勉強して, 来て' },
    ],
    drill: 'te',
  },
  {
    id: 'ta',
    level: 'N5',
    title: 'た형 (과거형)',
    tip: 'て형과 규칙이 완전히 같습니다. て→た, で→だ로만 바꾸면 끝.',
    rows: [
      { rule: 'て형의 て→た, で→だ', example: '買って→買った, 飲んで→飲んだ' },
      { rule: '2그룹: る 떼고 + た', example: '食べる→食べた' },
      { rule: '3그룹: した / 来た', example: '勉強した, 来た' },
    ],
    drill: 'ta',
  },
  {
    id: 'nai',
    level: 'N5',
    title: 'ない형 (부정형)',
    tip: '"~하지 않다". 1그룹은 어미를 a단으로. 단 う는 わ가 됩니다 (買う→買わない).',
    rows: [
      { rule: '1그룹: 어미 → a단 + ない (う→わ)', example: '書く→書かない, 買う→買わない' },
      { rule: '2그룹: る 떼고 + ない', example: '食べる→食べない' },
      { rule: '3그룹: しない / 来ない(こない)', example: '勉強しない' },
    ],
    drill: 'nai',
  },
  {
    id: 'iadj',
    level: 'N5',
    title: 'い형용사 활용',
    tip: 'い를 떼고 붙이면 끝. 부사(〜く)와 명사화(〜さ)도 같은 원리입니다. 단 いい는 よ로 활용 (よくない).',
    rows: [
      { rule: '부정: 〜い → 〜くない', example: '高い→高くない' },
      { rule: '과거: 〜い → 〜かった', example: '高い→高かった' },
      { rule: '연결(て형): 〜い → 〜くて', example: '高くて おいしい' },
      { rule: '부사화: 〜い → 〜く', example: '早い→早く (빨리)' },
      { rule: '명사화: 〜い → 〜さ', example: '高い→高さ (높이)' },
    ],
    drill: 'iadj',
  },
  {
    id: 'naadj',
    level: 'N5',
    title: 'な형용사·명사 술어',
    tip: 'な형용사와 명사는 활용이 동일합니다. 부사화는 +に (静かに 조용히).',
    rows: [
      { rule: '부정: + じゃない', example: '静か→静かじゃない' },
      { rule: '과거: + だった', example: '静か→静かだった' },
      { rule: '연결(て형): + で', example: '静かで きれいだ' },
      { rule: '부사화: + に', example: '静か→静かに' },
      { rule: '명사 수식: + な', example: '静かな 部屋' },
    ],
    drill: 'naadj',
  },
  {
    id: 'potential',
    level: 'N4',
    title: '가능형 (~할 수 있다)',
    tip: '1그룹은 어미를 e단+る로. 2그룹의 られる는 수동형과 모양이 같으니 문맥으로 구분합니다.',
    rows: [
      { rule: '1그룹: 어미 → e단 + る', example: '書く→書ける, 飲む→飲める' },
      { rule: '2그룹: る 떼고 + られる', example: '食べる→食べられる' },
      { rule: '3그룹: できる / 来られる', example: '勉強できる' },
    ],
    drill: 'potential',
  },
  {
    id: 'derive',
    level: 'N5',
    title: '품사 변형 총정리 (파생)',
    tip: '단어 하나를 외우면 가족 전체를 얻습니다. 단어장에서 休む(쉬다)와 休み(휴일)를 둘 다 본 이유입니다.',
    rows: [
      { rule: '동사 → 명사: ます형 어간', example: '休む→休み(휴일), 話す→話(이야기)' },
      { rule: 'い형용사 → 부사: 〜く', example: '早い→早く (빨리)' },
      { rule: 'い형용사 → 명사: 〜さ', example: '高い→高さ, 寒い→寒さ' },
      { rule: 'な형용사 → 부사: 〜に', example: '静か→静かに, 上手→上手に' },
      { rule: '명사 → な형용사: 〜的(てき)', example: '経済→経済的' },
      { rule: '동사 → 희망: ます형 어간 + たい', example: '食べる→食べたい (먹고 싶다)' },
    ],
    drill: 'none',
  },
]
