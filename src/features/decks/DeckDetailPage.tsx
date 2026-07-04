import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Card } from '../../db/schema'
import { useTts } from '../../lib/useTts'
import CardEditor from './CardEditor'

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Card | 'new' | null>(null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const tts = useTts()
  const navigate = useNavigate()

  const deck = useLiveQuery(() => (id ? db.decks.get(id) : undefined), [id])
  const cards = useLiveQuery(
    () => (id ? db.cards.where('deckId').equals(id).toArray() : []),
    [id],
  )

  if (!deck || !cards) return <p className="text-sm text-slate-400">불러오는 중…</p>

  const isCustom = deck.source === 'custom'
  const flaggedCount = cards.filter((c) => c.flagged).length
  const q = query.trim()
  let filtered = q
    ? cards.filter((c) => c.kanji.includes(q) || c.kana.includes(q) || c.ko.includes(q))
    : cards
  if (flaggedOnly) filtered = filtered.filter((c) => c.flagged)

  async function removeCard(card: Card) {
    if (!window.confirm(`'${card.kanji}' 단어를 삭제할까요?`)) return
    await db.transaction('rw', [db.cards, db.srs, db.decks], async () => {
      await db.cards.delete(card.id)
      await db.srs.delete(card.id)
      const d = await db.decks.get(card.deckId)
      if (d) await db.decks.update(card.deckId, { cardCount: Math.max(0, d.cardCount - 1) })
    })
  }

  async function removeDeck() {
    if (!deck || !window.confirm(`'${deck.name}' 단어장을 통째로 삭제할까요?`)) return
    await db.transaction('rw', [db.decks, db.cards, db.srs], async () => {
      await db.cards.where('deckId').equals(deck.id).delete()
      await db.srs.where('deckId').equals(deck.id).delete()
      await db.decks.delete(deck.id)
    })
    navigate('/decks')
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/decks" className="text-xs text-slate-400">
            ← 단어장 목록
          </Link>
          <h1 className="text-xl font-bold">{deck.name}</h1>
        </div>
        <span className="text-sm text-slate-400">{filtered.length}단어</span>
      </header>

      {isCustom && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            + 단어 추가
          </button>
          <button
            type="button"
            onClick={removeDeck}
            className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-red-500 shadow-sm ring-1 ring-red-100"
          >
            단어장 삭제
          </button>
        </div>
      )}

      {editing && id && (
        <CardEditor
          deckId={id}
          card={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="한자·읽기·뜻 검색"
        className="w-full rounded-xl border border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300"
      />

      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={() => setFlaggedOnly((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            flaggedOnly ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 ring-1 ring-rose-100'
          }`}
        >
          🚩 신고한 단어 {flaggedCount}
        </button>
      )}

      <ul className="divide-y divide-rose-50 rounded-2xl bg-white shadow-sm">
        {filtered.map((card) => (
          <li key={card.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-ja text-lg font-semibold">
                {card.kanji}
                {card.kana !== card.kanji && (
                  <span className="ml-2 text-sm font-normal text-slate-400">{card.kana}</span>
                )}
              </p>
              <p className="truncate text-sm text-slate-500">{card.ko}</p>
              {card.exJa && (
                <p className="mt-0.5 truncate font-ja text-xs text-slate-400">{card.exJa}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {card.pos && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {card.pos}
                </span>
              )}
              {tts.available && (
                <button
                  type="button"
                  onClick={() => tts.speak(card.kana)}
                  className="rounded-full p-1.5 text-lg leading-none hover:bg-rose-50"
                  aria-label="발음 듣기"
                >
                  🔊
                </button>
              )}
              <button
                type="button"
                onClick={() => void db.cards.update(card.id, { flagged: !card.flagged })}
                className={`rounded-full p-1.5 text-sm leading-none hover:bg-rose-50 ${
                  card.flagged ? '' : 'opacity-30 grayscale'
                }`}
                aria-label={card.flagged ? '신고 해제' : '뜻 오류 신고'}
                title={card.flagged ? '신고 해제' : '뜻이 이상하면 신고'}
              >
                🚩
              </button>
              {isCustom && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(card)}
                    className="rounded-full p-1.5 text-sm leading-none hover:bg-rose-50"
                    aria-label="수정"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeCard(card)}
                    className="rounded-full p-1.5 text-sm leading-none hover:bg-rose-50"
                    aria-label="삭제"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-400">
            {isCustom && cards.length === 0 ? '위의 + 단어 추가로 첫 단어를 넣어 보세요.' : '검색 결과가 없습니다.'}
          </li>
        )}
      </ul>
    </div>
  )
}
