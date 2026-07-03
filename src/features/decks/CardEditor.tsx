import { useState } from 'react'
import { db, type Card } from '../../db/schema'

interface Props {
  deckId: string
  /** 수정 모드일 때 대상 카드 */
  card?: Card
  onClose: () => void
}

export default function CardEditor({ deckId, card, onClose }: Props) {
  const [kanji, setKanji] = useState(card?.kanji ?? '')
  const [kana, setKana] = useState(card?.kana ?? '')
  const [ko, setKo] = useState(card?.ko ?? '')

  async function save() {
    const k = kanji.trim()
    const r = kana.trim() || k
    const m = ko.trim()
    if (!k || !m) return

    if (card) {
      await db.cards.update(card.id, { kanji: k, kana: r, ko: m })
    } else {
      const id = `custom-${crypto.randomUUID().slice(0, 12)}`
      await db.transaction('rw', [db.cards, db.srs, db.decks], async () => {
        await db.cards.add({ id, deckId, kanji: k, kana: r, ko: m })
        await db.srs.add({
          cardId: id,
          deckId,
          state: 'new',
          ef: 2.5,
          intervalDays: 0,
          stepIndex: 0,
          reps: 0,
          lapses: 0,
          dueAt: 0,
          lastReviewedAt: null,
        })
        const deck = await db.decks.get(deckId)
        if (deck) await db.decks.update(deckId, { cardCount: deck.cardCount + 1 })
      })
    }
    onClose()
  }

  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-rose-200">
      <p className="text-sm font-semibold">{card ? '단어 수정' : '단어 추가'}</p>
      <input
        value={kanji}
        onChange={(e) => setKanji(e.target.value)}
        placeholder="단어 (예: 勉強)"
        className="w-full rounded-lg border border-rose-100 px-3 py-2 font-ja text-sm"
      />
      <input
        value={kana}
        onChange={(e) => setKana(e.target.value)}
        placeholder="읽기 (예: べんきょう) — 비우면 단어와 동일"
        className="w-full rounded-lg border border-rose-100 px-3 py-2 font-ja text-sm"
      />
      <input
        value={ko}
        onChange={(e) => setKo(e.target.value)}
        placeholder="뜻 (예: 공부)"
        className="w-full rounded-lg border border-rose-100 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-500"
        >
          취소
        </button>
      </div>
    </div>
  )
}
