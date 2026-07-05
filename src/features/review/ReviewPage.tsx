import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db, type Grade } from '../../db/schema'
import { buildDailyQueue, type QueueItem } from '../../srs/queue'
import { recordReview } from '../../lib/stats'
import { useTts } from '../../lib/useTts'

const GRADE_BUTTONS: { grade: Grade; label: string; cls: string }[] = [
  { grade: 0, label: '다시', cls: 'bg-red-50 text-red-500 ring-1 ring-red-100' },
  { grade: 1, label: '어려움', cls: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' },
  { grade: 2, label: '좋음', cls: 'bg-emerald-500 text-white' },
  { grade: 3, label: '쉬움', cls: 'bg-slate-800 text-white' },
]

/** 이 시간(ms) 안에 다시 due가 되는 카드는 현재 세션에 다시 넣는다. */
const REQUEUE_WINDOW_MS = 15 * 60_000

export default function ReviewPage() {
  const [params] = useSearchParams()
  const deckId = params.get('deck') ?? undefined

  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [flagged, setFlagged] = useState(false)
  const shownAt = useRef(Date.now())
  const tts = useTts()

  useEffect(() => {
    let alive = true
    buildDailyQueue(deckId).then((q) => {
      if (alive) setQueue(q)
    })
    return () => {
      alive = false
    }
  }, [deckId])

  const currentCardId = queue?.[0]?.card.id
  const currentFlagged = queue?.[0]?.card.flagged
  useEffect(() => {
    setFlagged(!!currentFlagged)
  }, [currentCardId, currentFlagged])

  async function toggleFlag() {
    const card = queue?.[0]?.card
    if (!card) return
    const next = !flagged
    setFlagged(next)
    card.flagged = next
    await db.cards.update(card.id, { flagged: next })
  }

  if (!queue) return <p className="text-sm text-slate-400">큐를 만드는 중…</p>

  const current = queue[0]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="text-xl font-bold">오늘 복습 완료!</h1>
        <p className="text-sm text-slate-500">{done > 0 ? `${done}장을 학습했습니다.` : '지금은 복습할 카드가 없습니다.'}</p>
        <Link to="/" className="rounded-xl bg-rose-600 px-6 py-2.5 font-semibold text-white">
          홈으로
        </Link>
      </div>
    )
  }

  async function grade(g: Grade) {
    if (!current) return
    const ms = Date.now() - shownAt.current
    const next = await recordReview(current.card, g, 'flash', ms)
    setQueue((q) => {
      if (!q) return q
      const rest = q.slice(1)
      // 곧 다시 due가 되는 카드(학습 단계)는 세션 뒤쪽에 재삽입
      if (next && next.dueAt <= Date.now() + REQUEUE_WINDOW_MS) {
        return [...rest, { card: current.card, srs: next }]
      }
      return rest
    })
    setDone((d) => d + 1)
    setFlipped(false)
    shownAt.current = Date.now()
  }

  return (
    <div className="flex min-h-[70svh] flex-col">
      <header className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <Link to="/">← 나가기</Link>
        <span>남은 카드 {queue.length}</span>
      </header>

      <button
        type="button"
        onClick={() => setFlipped(true)}
        className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-slate-200 bg-white p-6"
      >
        <p className="font-ja-display text-6xl leading-tight">{current.card.kanji}</p>
        {flipped ? (
          <div className="space-y-2.5 text-center">
            {current.card.kana !== current.card.kanji && (
              <p className="font-ja text-2xl font-semibold text-rose-600">{current.card.kana}</p>
            )}
            <p className="text-xl font-semibold">
              {current.card.emoji && <span className="mr-2 text-3xl align-middle">{current.card.emoji}</span>}
              {current.card.ko}
            </p>
            {current.card.pos && <p className="text-xs text-slate-400">{current.card.pos}</p>}
            {current.card.exJa && (
              <div className="mx-auto flex max-w-xs items-start gap-2 rounded-xl bg-slate-100 px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className="font-ja text-sm leading-relaxed">{current.card.exJa}</p>
                  {current.card.exKo && (
                    <p className="mt-1 text-xs text-slate-500">{current.card.exKo}</p>
                  )}
                </div>
                {tts.available && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      tts.speak(current.card.exJa!)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') tts.speak(current.card.exJa!)
                    }}
                    className="shrink-0 rounded-full p-1 text-base hover:bg-white"
                    aria-label="예문 듣기"
                  >
                    🔊
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              {tts.available && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    tts.speak(current.card.kana)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') tts.speak(current.card.kana)
                  }}
                  className="inline-block rounded-full px-3 py-1 text-2xl hover:bg-rose-50"
                  aria-label="발음 듣기"
                >
                  🔊
                </span>
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleFlag()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void toggleFlag()
                }}
                className={`inline-block rounded-full px-3 py-1 text-xl hover:bg-rose-50 ${
                  flagged ? '' : 'opacity-30 grayscale'
                }`}
                aria-label="뜻 오류 신고"
                title="뜻이 이상하면 신고"
              >
                🚩
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">탭해서 답 확인</p>
        )}
      </button>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {flipped ? (
          GRADE_BUTTONS.map((b) => (
            <button
              key={b.grade}
              type="button"
              onClick={() => grade(b.grade)}
              className={`rounded-xl py-3.5 text-sm font-bold ${b.cls}`}
            >
              {b.label}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="col-span-4 rounded-xl bg-rose-600 py-3.5 font-bold text-white"
          >
            답 보기
          </button>
        )}
      </div>
    </div>
  )
}
