import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Card } from '../../db/schema'
import { getSetting } from '../../db/schema'
import { buildDailyQueue } from '../../srs/queue'
import { bumpDaily, recordReview } from '../../lib/stats'
import ProgressRing from '../../components/ProgressRing'
import { useTts } from '../../lib/useTts'

type Phase = 'ready' | 'playing' | 'done'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MicroPage() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [seconds, setSeconds] = useState(26)
  const [remaining, setRemaining] = useState(26)
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [known, setKnown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)
  const tts = useTts()

  // 카드가 바뀌면 자동 발음 (음성이 있을 때)
  const currentCardKana = phase === 'playing' ? cards[index]?.kana : undefined
  useEffect(() => {
    if (currentCardKana && tts.available) tts.speak(currentCardKana)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCardKana, tts.available])

  // 스와이프: 오른쪽 = 알아요, 왼쪽 = 몰라요
  const [dx, setDx] = useState(0)
  const dragFrom = useRef<number | null>(null)
  const SWIPE_THRESHOLD = 90

  function onPointerDown(e: React.PointerEvent) {
    dragFrom.current = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom.current !== null) setDx(e.clientX - dragFrom.current)
  }
  function onPointerEnd() {
    if (dragFrom.current === null) return
    const d = dx
    dragFrom.current = null
    setDx(0)
    if (d > SWIPE_THRESHOLD) answer(true)
    else if (d < -SWIPE_THRESHOLD) answer(false)
  }

  useEffect(() => {
    getSetting('microSeconds', 26).then((s) => {
      setSeconds(s)
      setRemaining(s)
    })
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function start() {
    // 오늘의 큐 우선, 부족하면 전체에서 랜덤 보충
    const queue = await buildDailyQueue()
    let pool: Card[] = queue.map((q) => q.card)
    if (pool.length < 10) {
      const all = await db.cards.toArray()
      const have = new Set(pool.map((c) => c.id))
      pool = [...pool, ...shuffle(all.filter((c) => !have.has(c.id))).slice(0, 30 - pool.length)]
    }
    setCards(shuffle(pool))
    setIndex(0)
    setAnswered(0)
    setKnown(0)
    setRemaining(seconds)
    finishedRef.current = false
    setPhase('playing')

    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const left = seconds - Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(Math.max(0, left))
      if (left <= 0) void finish()
    }, 250)
  }

  async function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('done')
    await bumpDaily({ microSessions: 1, studySeconds: seconds })
  }

  function answer(knows: boolean) {
    const card = cards[index]
    if (!card || phase !== 'playing') return
    void recordReview(card, knows ? 2 : 0, 'micro')
    setAnswered((a) => a + 1)
    if (knows) setKnown((k) => k + 1)
    if (index + 1 >= cards.length) {
      void finish()
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 pt-12 text-center">
        <h1 className="text-xl font-bold">⚡ 26초 학습</h1>
        <p className="text-sm text-slate-500">
          {seconds}초 동안 최대한 많은 단어를 판정하세요.
          <br />
          아는 단어는 <b>알아요</b>, 모르면 <b>몰라요</b>!
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-slate-800 px-10 py-10 text-2xl font-extrabold text-white shadow-lg ring-4 ring-amber-300/60"
        >
          시작!
        </button>
        <Link to="/" className="text-sm text-slate-400">
          ← 홈으로
        </Link>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">⚡</p>
        <h1 className="text-xl font-bold">수고했어요!</h1>
        <p className="text-lg">
          {answered}단어 판정 · <span className="font-bold text-emerald-600">{known}</span>개 알아요
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPhase('ready')}
            className="rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-white"
          >
            한 번 더
          </button>
          <Link to="/" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-rose-600 shadow-sm">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  const card = cards[index]

  return (
    <div className="flex min-h-[70svh] flex-col items-center gap-6 pt-4">
      <ProgressRing progress={remaining / seconds} size={96}>
        <span className="text-2xl font-bold text-rose-600">{remaining}</span>
      </ProgressRing>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 25}deg)`,
          transition: dragFrom.current === null ? 'transform 0.15s ease' : 'none',
          touchAction: 'pan-y',
        }}
        className="relative flex w-full flex-1 cursor-grab flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center active:cursor-grabbing"
      >
        <span
          className="absolute left-4 top-4 rounded-lg bg-emerald-500 px-2 py-1 text-sm font-bold text-white"
          style={{ opacity: Math.min(1, Math.max(0, dx) / SWIPE_THRESHOLD) }}
        >
          알아요 ✨
        </span>
        <span
          className="absolute right-4 top-4 rounded-lg bg-red-500 px-2 py-1 text-sm font-bold text-white"
          style={{ opacity: Math.min(1, Math.max(0, -dx) / SWIPE_THRESHOLD) }}
        >
          몰라요 😅
        </span>
        {card?.emoji && <p className="text-4xl leading-none">{card.emoji}</p>}
        <p className="font-ja-display text-6xl leading-tight">{card?.kanji}</p>
        {card && card.kana !== card.kanji && (
          <p className="font-ja text-xl font-semibold text-rose-600">{card.kana}</p>
        )}
        <p className="text-lg font-semibold text-slate-600">{card?.ko}</p>
        {card?.exJa && (
          <div className="mx-auto max-w-xs rounded-xl bg-slate-100 px-3 py-2 text-left">
            <p className="font-ja text-xs leading-relaxed">{card.exJa}</p>
            {card.exKo && <p className="mt-0.5 text-[11px] text-slate-500">{card.exKo}</p>}
          </div>
        )}
        {tts.available && card && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => tts.speak(card.kana)}
            className="rounded-full bg-rose-50 px-3 py-1 text-lg ring-1 ring-rose-100"
            aria-label="발음 듣기"
          >
            🔊
          </button>
        )}
        <p className="text-[11px] text-slate-300">← 몰라요 · 밀어서 판정 · 알아요 →</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => answer(false)}
          className="rounded-2xl bg-red-50 py-4 text-lg font-bold text-red-500 ring-1 ring-red-100"
        >
          몰라요
        </button>
        <button
          type="button"
          onClick={() => answer(true)}
          className="rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-white"
        >
          알아요
        </button>
      </div>
    </div>
  )
}
