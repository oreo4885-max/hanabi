import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Card } from '../../db/schema'
import { getSetting } from '../../db/schema'
import { buildDailyQueue } from '../../srs/queue'
import { bumpDaily, recordReview } from '../../lib/stats'
import ProgressRing from '../../components/ProgressRing'

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

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center">
        <p className="font-ja-display text-6xl leading-tight">{card?.kanji}</p>
        {card && card.kana !== card.kanji && (
          <p className="font-ja text-xl font-semibold text-rose-600">{card.kana}</p>
        )}
        <p className="text-lg font-semibold text-slate-600">{card?.ko}</p>
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
