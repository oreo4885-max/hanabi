import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, getSetting, type Card } from '../../db/schema'
import { useSession } from '../../stores/session'
import { generateQuestions, makeCloze, type Question } from './generate'
import { isCorrectKana } from '../../lib/kana'
import { bumpDaily, logQuizAnswer, recordReview } from '../../lib/stats'
import { useTts } from '../../lib/useTts'
import Furigana from '../../components/Furigana'
import { kanaReading, speakableExample } from '../../lib/furigana'
import { normalizeSentence, scoreCompose, type ComposeResult } from '../../lib/compose'
import ComposeFeedback from './ComposeFeedback'

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
  const [composeResult, setComposeResult] = useState<ComposeResult | null>(null)
  const [percentSum, setPercentSum] = useState(0)
  const [hintShown, setHintShown] = useState(false)
  const [selfMarked, setSelfMarked] = useState(false)
  const composing = useRef(false)
  const [showReading, setShowReading] = useState(false)
  const tts = useTts()

  useEffect(() => {
    getSetting('showReading', true).then(setShowReading)
  }, [])

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

  // 만들 수 있는 문제가 없는 경우 (작문은 후리가나 예문이 있어야 한다)
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">📭</p>
        <h1 className="text-lg font-bold">이 단어장에는 낼 수 있는 문제가 없어요</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          {config.mode === 'compose' ? (
            <>
              작문 퀴즈는 후리가나 예문이 있어야 채점할 수 있습니다.
              <br />
              지금은 <b>N5·N4</b> 단어장에서 이용해 주세요.
            </>
          ) : (
            <>이 유형에 맞는 예문이 있는 단어가 없습니다. 다른 유형을 골라 주세요.</>
          )}
        </p>
        <Link to="/quiz" className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white">
          다른 유형 고르기
        </Link>
      </div>
    )
  }

  // 세션 종료 화면
  if (!q) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-5xl">{correctCount === questions.length ? '🏆' : '📝'}</p>
        <h1 className="text-xl font-bold">퀴즈 완료!</h1>
        <p className="text-lg">
          <span className="font-bold text-rose-600">{correctCount}</span> / {questions.length} 정답
        </p>
        {config.mode === 'compose' && (
          <p className="text-sm text-slate-500">
            평균 정답률{' '}
            <span className="font-bold text-rose-600">
              {Math.round(percentSum / questions.length)}%
            </span>
          </p>
        )}
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
    await logQuizAnswer(q.card.id, config!.mode, correct)
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

  function submitCompose() {
    if (phase !== 'answering' || composing.current || !typed.trim()) return
    // 가나 정답(후리가나에서 유도) / 한자 정답 둘 다와 비교해 더 나은 쪽으로 채점
    const result = scoreCompose(typed, kanaReading(q.card.exFuri ?? ''), q.card.exJa ?? '')
    setComposeResult(result)
    setPercentSum((s) => s + result.percent)
    setPhase('feedback')
    // 작문은 사용자가 '제 답도 맞아요'를 누를 수 있으므로
    // 기록·SRS 반영은 '다음'을 누를 때로 미룬다
    if (tts.available) tts.speak(speakableExample(q.card))
  }

  /** 작문 결과를 확정해 기록에 남긴다 */
  async function commitCompose(correct: boolean) {
    if (correct) setCorrectCount((c) => c + 1)
    await bumpDaily({ quizTotal: 1, quizCorrect: correct ? 1 : 0 })
    await logQuizAnswer(q.card.id, 'compose', correct)
    if (!correct) {
      const srs = await db.srs.get(q.card.id)
      if (srs && srs.state !== 'new') await recordReview(q.card, 0, 'quiz')
    }
  }

  function nextCompose() {
    void commitCompose(!!composeResult?.correct || selfMarked)
    setSelfMarked(false)
    next()
  }

  function next() {
    setPhase('answering')
    setTyped('')
    setComposeResult(null)
    setHintShown(false)
    setIndex((i) => i + 1)
  }

  const isChoice =
    config.mode === 'word-to-meaning' || config.mode === 'meaning-to-word' || config.mode === 'cloze'
  const isCompose = config.mode === 'compose'

  return (
    <div className="flex min-h-[70svh] flex-col">
      <header className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <Link to="/quiz">← 나가기</Link>
        <span>
          {index + 1} / {questions.length}
        </span>
      </header>

      {/* 문제 */}
      <div
        className={`rounded-3xl border border-slate-200 bg-white text-center ${
          isCompose ? 'p-6' : 'p-8'
        }`}
      >
        {isCompose && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400">이 문장을 일본어로 써 보세요</p>
            <p className="text-xl font-bold leading-relaxed">{q.card.exKo}</p>
            {phase === 'answering' &&
              (hintShown ? (
                <p className="text-sm text-slate-500">
                  💡 <span className="font-ja font-semibold">{q.card.kanji}</span>
                  {q.card.kana !== q.card.kanji && (
                    <span className="font-ja text-slate-400"> ({q.card.kana})</span>
                  )}{' '}
                  — {q.card.ko}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setHintShown(true)}
                  className="rounded-full bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-100"
                >
                  💡 힌트 (핵심 단어)
                </button>
              ))}
          </div>
        )}
        {config.mode === 'meaning-to-word' && <p className="text-2xl font-bold">{q.card.ko}</p>}
        {config.mode === 'cloze' && (
          <div className="space-y-2">
            <p className="font-ja text-xl font-semibold leading-relaxed">{makeCloze(q.card)}</p>
            {q.card.exKo && <p className="text-sm text-slate-400">{q.card.exKo}</p>}
          </div>
        )}
        {config.mode === 'word-to-meaning' && (
          <div className="space-y-3">
            <p className="font-ja-display text-5xl leading-tight">{q.card.kanji}</p>
            {/* 주관식은 읽기가 정답이므로 뜻 고르기에서만 읽기 표시 */}
            {showReading && config.mode === 'word-to-meaning' && q.card.kana !== q.card.kanji && (
              <p className="font-ja text-lg text-slate-400">{q.card.kana}</p>
            )}
            {/* 주관식은 읽기가 정답이므로 문제 단계에서는 발음을 숨긴다 */}
            {tts.available && config.mode === 'word-to-meaning' && (
              <button
                type="button"
                onClick={() => tts.speak(q.card.kana)}
                className="rounded-full bg-rose-50 px-4 py-1.5 text-xl ring-1 ring-rose-100"
                aria-label="발음 듣기"
              >
                🔊
              </button>
            )}
          </div>
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

        {isCompose && (
          <div className="space-y-2">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onCompositionStart={() => {
                composing.current = true
              }}
              onCompositionEnd={() => {
                composing.current = false
              }}
              onKeyDown={(e) => {
                // 줄바꿈이 필요 없는 한 문장이라 Enter를 제출로 쓴다
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitCompose()
                }
              }}
              disabled={phase === 'feedback'}
              rows={2}
              placeholder="일본어로 입력 (로마자로 쳐도 히라가나로 바뀝니다)"
              className="w-full resize-none rounded-xl border border-rose-100 bg-white px-4 py-3 font-ja text-lg leading-relaxed outline-none focus:border-rose-300"
              autoFocus
            />
            {/* 로마자가 어떤 가나로 바뀌는지 실시간으로 보여준다 */}
            {phase === 'answering' && typed.trim() && (
              <p className="px-1 font-ja text-sm text-slate-400">→ {normalizeSentence(typed)}</p>
            )}
            {phase === 'answering' && (
              <button
                type="button"
                onClick={submitCompose}
                disabled={!typed.trim()}
                className="w-full rounded-xl bg-rose-600 py-3 font-semibold text-white disabled:opacity-40"
              >
                채점하기
              </button>
            )}
          </div>
        )}

        {!isChoice && !isCompose && (
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

      {/* 작문 피드백 — 정답률 · 틀린 곳 · 정답 문장 듣기 */}
      {phase === 'feedback' && isCompose && composeResult && (
        <div className="mt-4 space-y-3">
          <ComposeFeedback
            result={composeResult}
            card={q.card}
            onSpeak={tts.available ? () => tts.speak(speakableExample(q.card)) : undefined}
            onSelfMark={() => setSelfMarked(true)}
            selfMarked={selfMarked}
          />
          <button
            type="button"
            onClick={nextCompose}
            className="w-full rounded-xl bg-slate-800 py-3 font-semibold text-white"
          >
            다음
          </button>
        </div>
      )}

      {/* 피드백 */}
      {phase === 'feedback' && !isCompose && (
        <div
          className={`mt-4 rounded-2xl p-4 ${lastCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}
        >
          <p className={`font-bold ${lastCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
            {lastCorrect ? '정답! ⭕' : '오답 ❌'}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <span>
              <span className="font-ja font-semibold">{q.card.kanji}</span>
              {q.card.kana !== q.card.kanji && <span className="font-ja"> ({q.card.kana})</span>} —{' '}
              {q.card.ko}
            </span>
            {tts.available && (
              <button
                type="button"
                onClick={() => tts.speak(q.card.kana)}
                className="shrink-0 text-base"
                aria-label="단어 발음 듣기"
              >
                🔊
              </button>
            )}
          </p>
          {q.card.exJa && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs leading-relaxed text-slate-500">
              <span className="min-w-0">
                <Furigana
                  marked={q.card.exFuri}
                  plain={q.card.exJa}
                  deckId={q.card.deckId}
                  className="font-ja leading-loose"
                />
                {q.card.exKo && <span className="block">{q.card.exKo}</span>}
              </span>
              {tts.available && (
                <button
                  type="button"
                  onClick={() => tts.speak(speakableExample(q.card))}
                  className="shrink-0 text-base"
                  aria-label="예문 듣기"
                >
                  🔊
                </button>
              )}
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
