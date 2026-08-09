import { db, type Card, type Deck, type Level, type SrsState } from './schema'

interface SeedWord {
  id: string
  kanji: string
  kana: string
  ko: string
  pos?: string
  exJa?: string
  exKo?: string
  emoji?: string
  mnemonic?: string
}

interface SeedFile {
  level: string
  version: number
  attribution: string
  words: SeedWord[]
}

/** 레벨별 데이터는 필요할 때만 동적 로드 (모바일 첫 화면을 가볍게). version은 여기서 관리. */
// version은 '단어 + 문법을 한 덱으로 통합'하면서 전부 올렸다.
const BUNDLED: { level: Level; version: number; load: () => Promise<SeedFile> }[] = [
  { level: 'N5', version: 6, load: () => import('../data/n5.json').then((m) => m.default as SeedFile) },
  { level: 'N4', version: 5, load: () => import('../data/n4.json').then((m) => m.default as SeedFile) },
  { level: 'N3', version: 2, load: () => import('../data/n3.json').then((m) => m.default as SeedFile) },
  { level: 'N2', version: 2, load: () => import('../data/n2.json').then((m) => m.default as SeedFile) },
  { level: 'N1', version: 2, load: () => import('../data/n1.json').then((m) => m.default as SeedFile) },
]

function newSrsRow(cardId: string, deckId: string): SrsState {
  return {
    cardId,
    deckId,
    state: 'new',
    ef: 2.5,
    intervalDays: 0,
    stepIndex: 0,
    reps: 0,
    lapses: 0,
    dueAt: 0,
    lastReviewedAt: null,
  }
}

/** 덱 하나를 업서트: 카드 갱신 + 신고·SRS 진행 상태 보존 */
async function upsertDeck(deckId: string, name: string, level: Level, words: SeedWord[]): Promise<void> {
  const deck: Deck = {
    id: deckId,
    name,
    level,
    source: 'bundled',
    createdAt: Date.now(),
    cardCount: words.length,
  }

  const cards: Card[] = words.map((w) => ({
    id: w.id,
    deckId,
    kanji: w.kanji,
    kana: w.kana,
    ko: w.ko,
    pos: w.pos,
    exJa: w.exJa,
    exKo: w.exKo,
    emoji: w.emoji,
    mnemonic: w.mnemonic,
    level,
  }))

  await db.transaction('rw', [db.decks, db.cards, db.srs, db.settings], async () => {
    const existingDeck = await db.decks.get(deckId)
    await db.decks.put({ ...deck, createdAt: existingDeck?.createdAt ?? deck.createdAt })

    // flagged 상태 보존을 위해 기존 카드와 병합
    const existingFlags = new Map<string, boolean>()
    await db.cards.where('deckId').equals(deckId).each((c) => {
      if (c.flagged) existingFlags.set(c.id, true)
    })
    await db.cards.bulkPut(
      cards.map((c) => (existingFlags.has(c.id) ? { ...c, flagged: true } : c)),
    )

    // SRS 행은 없는 카드에만 생성 (기존 진행 상태 보존)
    const existingSrs = new Set(
      (await db.srs.where('deckId').equals(deckId).primaryKeys()) as string[],
    )
    const newRows = cards.filter((c) => !existingSrs.has(c.id)).map((c) => newSrsRow(c.id, deckId))
    if (newRows.length > 0) await db.srs.bulkAdd(newRows)
  })
}

interface GrammarFile {
  version: number
  levels: Record<string, SeedWord[]>
}

/**
 * 예전 버전에서 나뉘어 있던 'grammar-*' 덱을 같은 레벨의 'jlpt-*' 덱으로 흡수한다.
 * 학습 진도(SRS)는 cardId 기준이라 그대로 유지되고, deckId만 옮겨진다.
 */
async function mergeLegacyGrammarDecks(): Promise<void> {
  const legacy = await db.decks.filter((d) => d.id.startsWith('grammar-')).toArray()
  if (legacy.length === 0) return

  for (const deck of legacy) {
    const target = `jlpt-${(deck.level ?? 'N5').toLowerCase()}`
    await db.transaction('rw', [db.decks, db.cards, db.srs], async () => {
      await db.cards.where('deckId').equals(deck.id).modify({ deckId: target })
      await db.srs
        .where('deckId')
        .equals(deck.id)
        .modify((s) => {
          s.deckId = target
          // 이미 동기화 대상인(학습한) 행만 갱신해 불필요한 업로드를 막는다
          if (s.updatedAt) s.updatedAt = Date.now()
        })
      await db.decks.delete(deck.id)
    })
  }
}

/** 번들 데이터셋을 IndexedDB에 시딩. version이 오르면 카드 내용만 갱신(SRS 진행 상태는 보존). */
export async function seedBundledDecks(): Promise<void> {
  await mergeLegacyGrammarDecks()

  const grammar = (await import('../data/grammar.json')).default as unknown as GrammarFile

  for (const bundle of BUNDLED) {
    const { level, version } = bundle
    const deckId = `jlpt-${level.toLowerCase()}`
    const versionKey = `seed:${deckId}:version`

    const seeded = await db.settings.get(versionKey)
    if (seeded !== undefined && (seeded.value as number) >= version) continue

    const file = await bundle.load()
    // 같은 레벨의 단어와 문형을 한 덱으로 (단어 먼저, 문형 뒤)
    const patterns = grammar.levels[level.toLowerCase()] ?? []
    await upsertDeck(deckId, `JLPT ${level}`, level, [...file.words, ...patterns])
    await db.settings.put({ key: versionKey, value: version })
  }
}
