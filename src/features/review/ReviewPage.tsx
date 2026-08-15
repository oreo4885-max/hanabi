import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getSetting, type Grade } from '../../db/schema'
import { buildDailyQueue, type QueueItem } from '../../srs/queue'
import { recordReview } from '../../lib/stats'
import { useTts } from '../../lib/useTts'
import Mnemonic from '../../components/Mnemonic'
import KanjiBreakdown from '../../components/KanjiBreakdown'
import PitchAccent from '../../components/PitchAccent'
import Furigana from '../../components/Furigana'
import { speakableExample } from '../../lib/furigana'
import { useSession } from '../../stores/session'
import GradeSlider from './GradeSlider'

/** 이 시간(ms) 안에 다시 due가 되는 카드는 현재 세션에 다시 넣는다. */
const REQUEUE_WINDOW_MS = 15 * 60_000

export default function ReviewPage() {
  const [params] = useSearchParams()
  const deckId = params.get('deck') ?? undefined

  // 단어장에 다녀와도 보던 카드로 돌아오도록 세션을 전역에 보관한다
  const session = useSession((s) => s.review)
  const setSession = useSession((s) => s.setReview)
  const updateSession = useSession((s) => s.updateReview)

  const resumable = session && session.deckId === deckId ? session : null
  const [queue, setQueue] = useState<QueueItem[] | null>(resumable?.queue ?? null)
  const [flipped, setFlipped] = useState(resumable?.flipped ?? false)
  const [done, setDone] = useState(resumable?.done ?? 0)
  const [showReading, setShowReading] = useState(false)

  useEffect(() => {
    getSetting('showReading', true).then(setShowReading)
  }, [])
  const shownAt = useRef(Date.now())
  const tts = useTts()

  useEffect(() => {
    // 이어서 볼 세션이 있으면 큐를 새로 만들지 않는다
    if (resumable) return
    let alive = true
    buildDailyQueue(deckId).then((q) => {
      if (!alive) return
      setQueue(q)
      setDone(0)
      setFlipped(false)
      setSession({ deckId, queue: q, done: 0, flipped: false })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId])

  if (!queue) return <p className="text-sm text-slate-400">큐를 만드는 중…</p>

  const current = queue[0]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="text-xl font-bold">오늘 복습 완료!</h1>
        <p className="text-sm text-slate-500">{done > 0 ? `${done}장을 학습했습니다.` : '지금은 복습할 카드가 없습니다.'}</p>
        <Link
          to="/"
          onClick={() => setSession(null)}
          className="rounded-xl bg-rose-600 px-6 py-2.5 font-semibold text-white"
        >
          홈으로
        </Link>
      </div>
    )
  }

  function flip() {
    setFlipped(true)
    updateSession({ flipped: true })
  }

  async function grade(g: Grade) {
    if (!current) return
    const ms = Date.now() - shownAt.current
    const next = await recordReview(current.card, g, 'flash', ms)
    const rest = queue!.slice(1)
    // 곧 다시 due가 되는 카드(학습 단계)는 세션 뒤쪽에 재삽입
    const nextQueue =
      next && next.dueAt <= Date.now() + REQUEUE_WINDOW_MS
        ? [...rest, { card: current.card, srs: next }]
        : rest
    const nextDone = done + 1
    setQueue(nextQueue)
    setDone(nextDone)
    setFlipped(false)
    updateSession({ queue: nextQueue, done: nextDone, flipped: false })
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
        onClick={flip}
        className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-slate-200 bg-white p-6"
      >
        <div>
          <p className="font-ja-display text-6xl leading-tight">{current.card.kanji}</p>
          {/* 초급 배려: 설정이 켜져 있으면 앞면에도 읽기 표시 */}
          {!flipped && showReading && current.card.kana !== current.card.kanji && (
            <p className="mt-2 font-ja text-xl text-slate-400">{current.card.kana}</p>
          )}
        </div>
        {flipped ? (
          <div className="space-y-2.5 text-center">
            {/* 발음 버튼은 읽기 바로 옆에 둔다 (아래에 있으면 무엇을 읽어주는지 직관적이지 않음) */}
            <p className="flex items-center justify-center gap-2">
              {current.card.kana !== current.card.kanji && (
                <span className="font-ja text-2xl font-semibold text-rose-600">
                  {current.card.kana}
                </span>
              )}
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
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-lg ring-1 ring-rose-100"
                  aria-label="발음 듣기"
                >
                  🔊
                </span>
              )}
            </p>
            {current.card.pos !== '문형' && (
              <PitchAccent id={current.card.id} kana={current.card.kana.split(';')[0].trim()} />
            )}
            <p className="text-xl font-semibold">
              {current.card.emoji && <span className="mr-2 text-3xl align-middle">{current.card.emoji}</span>}
              {current.card.ko}
            </p>
            {current.card.pos && <p className="text-xs text-slate-400">{current.card.pos}</p>}
            {/* 한자 분해 + 한국 훈음 (문형 카드는 pos가 '문형'이라 자동 제외되는 경우가 대부분) */}
            {current.card.pos !== '문형' && <KanjiBreakdown word={current.card.kanji} />}
            {current.card.mnemonic && <Mnemonic text={current.card.mnemonic} />}
            {current.card.exJa && (
              <div className="mx-auto flex max-w-xs items-start gap-2 rounded-xl bg-slate-100 px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <Furigana
                    marked={current.card.exFuri}
                    plain={current.card.exJa}
                    deckId={current.card.deckId}
                    className="font-ja block text-sm leading-loose"
                  />
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
                      tts.speak(speakableExample(current.card))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') tts.speak(speakableExample(current.card))
                    }}
                    className="shrink-0 rounded-full p-1 text-base hover:bg-white"
                    aria-label="예문 듣기"
                  >
                    🔊
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">탭해서 답 확인</p>
        )}
      </button>

      {flipped ? (
        <GradeSlider onGrade={grade} />
      ) : (
        <button
          type="button"
          onClick={flip}
          className="mt-4 w-full rounded-xl bg-rose-600 py-3.5 font-bold text-white"
        >
          답 보기
        </button>
      )}
    </div>
  )
}
