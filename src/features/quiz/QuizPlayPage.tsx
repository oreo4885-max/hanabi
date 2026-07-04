import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, type Card } from '../../db/schema'
import { useSession } from '../../stores/session'
import { generateQuestions, makeCloze, type Question } from './generate'
import { isCorrectKana } from '../../lib/kana'
import { bumpDaily, recordReview } from '../../lib/stats'
import { useTts } from '../../lib/useTts'

type Phase = 'answering' | 'feedback'

export default function QuizPlayPage() {
  const navigate = useNavigate()
  const config = useSession((s) => s.quiz)

  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [typed, setTyped] = useState('')
  const composing = useRef(false)
  const tts = useTts()

  useEffect(() => {
    if (!config) {
      navigate('/quiz', { replace: true })
      return
    }
    let alive = true
    db.cards
      .where('deckId')
      .equals(config.deckId)
      .toArray()
      .then((cards) => {
        if (alive) setQuestions(generateQuestions(cards, config.mode, config.count))
      })
    return () => {
      alive = false
    }
  }, [config, navigate])

  const isDictation = config?.mode === 'dictation'
  const currentKana = questions?.[index]?.card.kana

  // 받아쓰기: 새 문항이 나오면 자동 재생 (음성 준비된 경우)
  useEffect(() => {
    if (isDictation && currentKana && tts.available && phase === 'answering') {
      tts.speak(currentKana)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDictation, currentKana, tts.available, phase])

  if (!config || !questions) return <p className="text-sm text-slate-400">문제를 만드는 중…</p>

  const q = questions[index]

  // 세션 종료 화면
  if (!q) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">{correctCount === questions.length ? '🏆' : '📝'}</p>
        <h1 className="text-xl font-bold">퀴즈 완료!</h1>
        <p className="text-lg">
          <span className="font-bold text-rose-600">{correctCount}</span> / {questions.length} 정답
        </p>
        <div className="flex gap-2">
          <Link to="/quiz" className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white">
            다시 풀기
          </Link>
          <Link to="/" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-rose-600 shadow-sm">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  async function submit(correct: boolean) {
    setLastCorrect(correct)
    setPhase('feedback')
    if (correct) setCorrectCount((c) => c + 1)
    await bumpDaily({ quizTotal: 1, quizCorrect: correct ? 1 : 0 })
    if (!correct) {
      // 이미 학습을 시작한 카드만 SRS에 오답 반영 (새 카드의 도입 순서는 건드리지 않음)
      const srs = await db.srs.get(q.card.id)
      if (srs && srs.state !== 'new') await recordReview(q.card, 0, 'quiz')
    }
  }

  function chooseAnswer(choice: Card) {
    if (phase !== 'answering') return
    void submit(choice.id === q.card.id || choice.ko === q.card.ko)
  }

  function submitTyped() {
    if (phase !== 'answering' || composing.current) return
    void submit(isCorrectKana(typed, q.card.kana))
  }

  function next() {
    setPhase('answering')
    setTyped('')
    setIndex((i) => i + 1)
  }

  const isChoice =
    config.mode === 'word-to-meaning' || config.mode === 'meaning-to-word' || config.mode === 'cloze'

  return (
    <div className="flex min-h-[70svh] flex-col">
      <header className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <Link to="/quiz">← 나가기</Link>
        <span>
          {index + 1} / {questions.length}
        </span>
      </header>

      {/* 문제 */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        {config.mode === 'meaning-to-word' && <p className="text-2xl font-bold">{q.card.ko}</p>}
        {config.mode === 'cloze' && (
          <div className="space-y-2">
            <p className="font-ja text-xl font-semibold leading-relaxed">{makeCloze(q.card)}</p>
            {q.card.exKo && <p className="text-sm text-slate-400">{q.card.exKo}</p>}
          </div>
        )}
        {(config.mode === 'word-to-meaning' || config.mode === 'typed') && (
          <p className="font-ja-display text-5xl leading-tight">{q.card.kanji}</p>
        )}
        {config.mode === 'dictation' && (
          <div className="space-y-3">
            {phase === 'feedback' ? (
              <p className="font-ja-display text-5xl leading-tight">{q.card.kanji}</p>
            ) : (
              <p className="text-sm text-slate-400">발음을 듣고 받아쓰세요</p>
            )}
            <button
              type="button"
              onClick={() => tts.speak(q.card.kana)}
              className="rounded-full bg-rose-100 px-6 py-3 text-3xl"
              aria-label="다시 듣기"
            >
              🔊
            </button>
          </div>
        )}
      </div>

      {/* 답안 영역 */}
      <div className="mt-4 flex-1 space-y-2">
        {isChoice &&
          q.choices?.map((choice) => {
            const isAnswer = choice.id === q.card.id || choice.ko === q.card.ko
            const showState = phase === 'feedback'
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => chooseAnswer(choice)}
                className={`block w-full rounded-xl border p-3 text-left ${
                  showState && isAnswer
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-rose-100 bg-white'
                } ${showState && !isAnswer ? 'opacity-50' : ''}`}
              >
                {config.mode === 'word-to-meaning' ? (
                  <span>{choice.ko}</span>
                ) : config.mode === 'cloze' ? (
                  <span className="font-ja font-semibold">
                    {choice.kanji}
                    {phase === 'feedback' && <span className="ml-2 text-sm font-normal text-slate-400">{choice.ko}</span>}
                  </span>
                ) : (
                  <span className="font-ja font-semibold">
                    {choice.kanji}
                    {phase === 'feedback' && choice.kana !== choice.kanji && (
                      <span className="ml-2 text-sm font-normal text-slate-400">{choice.kana}</span>
                    )}
                  </span>
                )}
              </button>
            )
          })}

        {!isChoice && (
          <div className="space-y-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onCompositionStart={() => {
                composing.current = true
              }}
              onCompositionEnd={() => {
                composing.current = false
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitTyped()
              }}
              disabled={phase === 'feedback'}
              placeholder={
                config.mode === 'dictation'
                  ? '들은 발음을 가나(또는 로마자)로 입력'
                  : '읽기를 히라가나(또는 로마자)로 입력'
              }
              className="w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-ja text-lg outline-none focus:border-rose-300"
              autoFocus
            />
            {phase === 'answering' && (
              <button
                type="button"
                onClick={submitTyped}
                className="w-full rounded-xl bg-rose-600 py-3 font-semibold text-white"
              >
                제출
              </button>
            )}
          </div>
        )}
      </div>

      {/* 피드백 */}
      {phase === 'feedback' && (
        <div
          className={`mt-4 rounded-2xl p-4 ${lastCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}
        >
          <p className={`font-bold ${lastCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
            {lastCorrect ? '정답! ⭕' : '오답 ❌'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-ja font-semibold">{q.card.kanji}</span>
            {q.card.kana !== q.card.kanji && <span className="font-ja"> ({q.card.kana})</span>} —{' '}
            {q.card.ko}
          </p>
          {q.card.exJa && (
            <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-xs leading-relaxed text-slate-500">
              <span className="font-ja">{q.card.exJa}</span>
              {q.card.exKo && <span className="block">{q.card.exKo}</span>}
            </p>
          )}
          <button
            type="button"
            onClick={next}
            className="mt-3 w-full rounded-xl bg-slate-800 py-3 font-semibold text-white"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
