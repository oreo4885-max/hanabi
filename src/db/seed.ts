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
const BUNDLED: { level: Level; version: number; load: () => Promise<SeedFile> }[] = [
  { level: 'N5', version: 5, load: () => import('../data/n5.json').then((m) => m.default as SeedFile) },
  { level: 'N4', version: 4, load: () => import('../data/n4.json').then((m) => m.default as SeedFile) },
  { level: 'N3', version: 1, load: () => import('../data/n3.json').then((m) => m.default as SeedFile) },
  { level: 'N2', version: 1, load: () => import('../data/n2.json').then((m) => m.default as SeedFile) },
  { level: 'N1', version: 1, load: () => import('../data/n1.json').then((m) => m.default as SeedFile) },
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

/** 번들 데이터셋을 IndexedDB에 시딩. version이 오르면 카드 내용만 갱신(SRS 진행 상태는 보존). */
export async function seedBundledDecks(): Promise<void> {
  for (const bundle of BUNDLED) {
    const { level, version } = bundle
    const deckId = `jlpt-${level.toLowerCase()}`
    const versionKey = `seed:${deckId}:version`

    const seeded = await db.settings.get(versionKey)
    if (seeded !== undefined && (seeded.value as number) >= version) continue

    const file = await bundle.load()

    const deck: Deck = {
      id: deckId,
      name: `JLPT ${level} 단어`,
      level,
      source: 'bundled',
      createdAt: Date.now(),
      cardCount: file.words.length,
    }

    const cards: Card[] = file.words.map((w) => ({
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

      await db.settings.put({ key: versionKey, value: version })
    })
  }
}
