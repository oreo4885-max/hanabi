import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Grade } from '../../db/schema'
import { buildDailyQueue, type QueueItem } from '../../srs/queue'
import { recordReview } from '../../lib/stats'
import { useTts } from '../../lib/useTts'

const GRADE_BUTTONS: { grade: Grade; label: string; cls: string }[] = [
  { grade: 0, label: '다시', cls: 'bg-red-500' },
  { grade: 1, label: '어려움', cls: 'bg-orange-400' },
  { grade: 2, label: '좋음', cls: 'bg-emerald-500' },
  { grade: 3, label: '쉬움', cls: 'bg-sky-500' },
]

/** 이 시간(ms) 안에 다시 due가 되는 카드는 현재 세션에 다시 넣는다. */
const REQUEUE_WINDOW_MS = 15 * 60_000

export default function ReviewPage() {
  const [params] = useSearchParams()
  const deckId = params.get('deck') ?? undefined

  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
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
        className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 shadow-sm"
      >
        <p className="font-ja text-5xl font-bold">{current.card.kanji}</p>
        {flipped ? (
          <div className="space-y-2 text-center">
            {current.card.kana !== current.card.kanji && (
              <p className="font-ja text-2xl text-rose-600">{current.card.kana}</p>
            )}
            <p className="text-xl">{current.card.ko}</p>
            {current.card.pos && <p className="text-xs text-slate-400">{current.card.pos}</p>}
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
              className={`rounded-xl py-3 font-semibold text-white ${b.cls}`}
            >
              {b.label}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="col-span-4 rounded-xl bg-rose-600 py-3 font-semibold text-white"
          >
            답 보기
          </button>
        )}
      </div>
    </div>
  )
}
