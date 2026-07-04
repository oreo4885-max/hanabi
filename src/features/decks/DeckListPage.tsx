import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getWeakCount } from '../../srs/queue'

export default function DeckListPage() {
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const weakCount = useLiveQuery(() => getWeakCount(), [])
  const navigate = useNavigate()

  async function createDeck() {
    const name = window.prompt('새 단어장 이름을 입력하세요.')?.trim()
    if (!name) return
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`
    await db.decks.add({ id, name, level: null, source: 'custom', createdAt: Date.now(), cardCount: 0 })
    navigate(`/decks/${id}`)
  }

  if (!decks) return <p className="text-sm text-slate-400">불러오는 중…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">단어장</h1>
        <button
          type="button"
          onClick={createDeck}
          className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          + 새 단어장
        </button>
      </div>
      {decks.length === 0 && (
        <p className="text-sm text-slate-500">단어장이 아직 없습니다. 잠시 후 새로고침해 보세요.</p>
      )}

      {(weakCount ?? 0) > 0 && (
        <Link
          to="/decks/weak"
          className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4"
        >
          <div>
            <p className="font-semibold">🔥 취약 단어</p>
            <p className="text-xs text-slate-400">자주 틀린 단어 자동 모음 · {weakCount}단어</p>
          </div>
          <span className="text-sm font-bold text-rose-600">집중 연습 →</span>
        </Link>
      )}
      <ul className="space-y-3">
        {decks.map((deck) => (
          <li key={deck.id}>
            <Link
              to={`/decks/${deck.id}`}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold">{deck.name}</p>
                <p className="text-xs text-slate-400">
                  {deck.source === 'bundled' ? '기본 제공' : '내 단어장'} · {deck.cardCount}단어
                </p>
              </div>
              {deck.level && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-600">
                  {deck.level}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
