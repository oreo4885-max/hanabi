import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toKatakana } from 'wanakana'
import { GROUPS, allChars, type KanaChar } from '../../data/kana'
import { useTts } from '../../lib/useTts'

type Script = 'hiragana' | 'katakana'
type View = 'chart' | 'quiz'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const QUIZ_LEN = 10

interface KanaQuestion {
  target: KanaChar
  choices: KanaChar[]
}

function buildQuiz(pool: KanaChar[]): KanaQuestion[] {
  return shuffle(pool)
    .slice(0, QUIZ_LEN)
    .map((target) => {
      const others = shuffle(pool.filter((c) => c.romaji !== target.romaji)).slice(0, 3)
      return { target, choices: shuffle([target, ...others]) }
    })
}

export default function KanaPage() {
  const [script, setScript] = useState<Script>('hiragana')
  const [groupKey, setGroupKey] = useState<(typeof GROUPS)[number]['key']>('seion')
  const [view, setView] = useState<View>('chart')
  const [revealed, setRevealed] = useState<string | null>(null)

  // 퀴즈 상태
  const [questions, setQuestions] = useState<KanaQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  const tts = useTts()
  const group = GROUPS.find((g) => g.key === groupKey)!
  const display = (kana: string) => (script === 'katakana' ? toKatakana(kana) : kana)
  const pool = useMemo(() => allChars(group.rows), [group])

  function startQuiz() {
    setQuestions(buildQuiz(pool))
    setQIndex(0)
    setScore(0)
    setPicked(null)
    setView('quiz')
  }

  function pick(c: KanaChar) {
    if (picked) return
    setPicked(c.romaji)
    if (c.romaji === questions[qIndex].target.romaji) setScore((s) => s + 1)
    if (tts.available) tts.speak(display(questions[qIndex].target.kana))
  }

  function nextQuestion() {
    setPicked(null)
    setQIndex((i) => i + 1)
  }

  const q = questions[qIndex]

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-slate-400">
            ← 홈
          </Link>
          <h1 className="text-xl font-bold">가나 익히기</h1>
        </div>
        {view === 'chart' ? (
          <button
            type="button"
            onClick={startQuiz}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white"
          >
            퀴즈 10문제
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView('chart')}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-500 ring-1 ring-slate-200"
          >
            표로 돌아가기
          </button>
        )}
      </header>

      {/* 문자 종류 / 그룹 선택 */}
      <div className="flex gap-2">
        {(['hiragana', 'katakana'] as Script[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScript(s)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold ${
              script === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {s === 'hiragana' ? 'ひらがな 히라가나' : 'カタカナ 가타카나'}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => {
              setGroupKey(g.key)
              setView('chart')
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              groupKey === g.key ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {view === 'chart' && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">글자를 누르면 발음과 로마자를 보여줍니다.</p>
          {group.rows.map((row) => (
            <div key={row.name} className="grid grid-cols-5 gap-1.5">
              {row.chars.map((c, i) =>
                c ? (
                  <button
                    key={c.kana}
                    type="button"
                    onClick={() => {
                      setRevealed(revealed === c.kana ? null : c.kana)
                      if (tts.available) tts.speak(display(c.kana))
                    }}
                    className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-2.5"
                  >
                    <span className="font-ja text-2xl font-semibold">{display(c.kana)}</span>
                    <span
                      className={`text-[11px] ${
                        revealed === c.kana ? 'text-rose-600 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {revealed === c.kana ? c.romaji : '·'}
                    </span>
                  </button>
                ) : (
                  <span key={`${row.name}-${i}`} />
                ),
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'quiz' && q && (
        <div className="space-y-4">
          <p className="text-center text-sm text-slate-400">
            {qIndex + 1} / {questions.length} · 맞힌 개수 {score}
          </p>
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <p className="font-ja text-7xl font-semibold">{display(q.target.kana)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {q.choices.map((c) => {
              const isAnswer = c.romaji === q.target.romaji
              return (
                <button
                  key={c.romaji + c.kana}
                  type="button"
                  onClick={() => pick(c)}
                  className={`rounded-xl border py-3.5 text-lg font-bold ${
                    picked && isAnswer
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                      : picked === c.romaji && !isAnswer
                        ? 'border-red-300 bg-red-50 text-red-500'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  {c.romaji}
                </button>
              )
            })}
          </div>
          {picked && (
            <button
              type="button"
              onClick={nextQuestion}
              className="w-full rounded-xl bg-slate-800 py-3 font-bold text-white"
            >
              다음
            </button>
          )}
        </div>
      )}

      {view === 'quiz' && !q && (
        <div className="flex flex-col items-center gap-4 pt-10 text-center">
          <p className="text-5xl">{score === questions.length ? '🏆' : 'あ'}</p>
          <p className="text-lg font-bold">
            {score} / {questions.length} 정답!
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startQuiz}
              className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white"
            >
              한 번 더
            </button>
            <button
              type="button"
              onClick={() => setView('chart')}
              className="rounded-xl bg-white px-5 py-2.5 font-semibold text-slate-500 ring-1 ring-slate-200"
            >
              표 보기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
