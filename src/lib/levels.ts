import type { Level } from '../db/schema'

/** 학습 순서: 쉬운 것부터 */
export const LEVEL_ORDER: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export const LEVEL_DESC: Record<Level, string> = {
  N5: '기초 — 히라가나·가타카나와 기본 단어',
  N4: '초급 — 일상 회화의 기본 표현',
  N3: '중급 — 일상 대화를 대체로 이해',
  N2: '중상급 — 신문·뉴스 등 폭넓은 주제',
  N1: '고급 — 논리적으로 복잡한 글까지',
}

/** 목표 레벨까지 학습해야 하는 레벨 목록 (N3 목표 → N5·N4·N3) */
export function levelsUpTo(target: Level): Level[] {
  const idx = LEVEL_ORDER.indexOf(target)
  return idx === -1 ? LEVEL_ORDER : LEVEL_ORDER.slice(0, idx + 1)
}

/** 목표 레벨에 해당하는 덱 id들 (레벨당 하나 — 단어와 문형이 함께 들어 있다) */
export function deckIdsForTarget(target: Level): string[] {
  return levelsUpTo(target).map((lv) => `jlpt-${lv.toLowerCase()}`)
}

/** 문형 카드 여부 (id가 gn5-001 형태) */
export function isGrammarCard(cardId: string): boolean {
  return cardId.startsWith('g')
}
