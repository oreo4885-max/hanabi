import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { useSession, type QuizMode } from '../../stores/session'
import { useTts } from '../../lib/useTts'
import { isComposable } from './generate'

const MODES: { mode: QuizMode; label: string; desc: string; needsTts?: boolean }[] = [
  { mode: 'word-to-meaning', label: '뜻 고르기', desc: '일본어 단어를 보고 한국어 뜻 선택' },
  { mode: 'meaning-to-word', label: '단어 고르기', desc: '한국어 뜻을 보고 일본어 단어 선택' },
  { mode: 'typed', label: '주관식 (읽기 입력)', desc: '단어를 보고 읽기(가나)를 직접 입력' },
  { mode: 'cloze', label: '예문 빈칸 채우기', desc: '예문의 빈칸에 들어갈 단어 선택' },
  { mode: 'dictation', label: '받아쓰기 (듣기)', desc: '발음을 듣고 가나로 받아쓰기', needsTts: true },
  {
    mode: 'compose',
    label: '작문 (문장 만들기)',
    desc: '한국어 문장을 보고 일본어 문장을 직접 입력 · 정답률과 틀린 곳을 알려줍니다',
  },
]

export default function QuizConfigPage() {
  const navigate = useNavigate()
  const setQuiz = useSession((s) => s.setQuiz)
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const [deckId, setDeckId] = useState('jlpt-n5')
  const [mode, setMode] = useState<QuizMode>('word-to-meaning')
  const [count, setCount] = useState(10)
  const tts = useTts()
  const modes = MODES.filter((m) => !m.needsTts || tts.available)

  // 작문은 후리가나 예문이 있어야 채점이 되므로 선택한 단어장의 가능 문항 수를 미리 센다
  const composable = useLiveQuery(
    async () =>
      mode === 'compose'
        ? db.cards.where('deckId').equals(deckId).filter(isComposable).count()
        : null,
    [mode, deckId],
  )
  const composeBlocked = mode === 'compose' && composable === 0

  function start() {
    if (composeBlocked) return
    setQuiz({ deckId, mode, count })
    navigate('/quiz/play')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">퀴즈</h1>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-600">단어장</p>
        <select
          value={deckId}
          onChange={(e) => setDeckId(e.target.value)}
          className="w-full rounded-xl border border-rose-100 bg-white px-4 py-2.5 text-sm"
        >
          {decks?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.cardCount})
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-600">유형</p>
        <div className="space-y-2">
          {modes.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setMode(m.mode)}
              className={`block w-full rounded-xl border p-3 text-left ${
                mode === m.mode ? 'border-rose-400 bg-rose-50' : 'border-rose-100 bg-white'
              }`}
            >
              <p className="font-semibold">{m.label}</p>
              <p className="text-xs text-slate-400">{m.desc}</p>
            </button>
          ))}
        </div>
        {mode === 'compose' && composable != null && (
          <p
            className={`rounded-xl p-3 text-xs leading-relaxed ${
              composeBlocked || composable < count ? 'bg-amber-50 text-amber-700' : 'text-slate-400'
            }`}
          >
            {composeBlocked ? (
              <>
                이 단어장에는 아직 작문 문제를 만들 수 없습니다. 작문은 <b>후리가나 예문</b>이 있어야
                채점이 가능해서 지금은 <b>N5·N4</b>에서만 이용할 수 있어요.
              </>
            ) : composable < count ? (
              <>
                이 단어장은 작문 가능 문항이 <b>{composable}개</b>뿐이라 {composable}문제만
                출제됩니다. 작문은 후리가나 예문이 갖춰진 <b>N5·N4</b>를 권합니다.
              </>
            ) : (
              <>
                작문 가능 문항 {composable.toLocaleString()}개 · 로마자로 입력해도 히라가나로 자동
                변환됩니다 (한자를 몰라도 정답 처리)
              </>
            )}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-600">문제 수</p>
        <div className="flex gap-2">
          {[10, 20, 30].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`flex-1 rounded-xl border py-2.5 font-semibold ${
                count === n ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-rose-100 bg-white'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={start}
        disabled={composeBlocked}
        className="w-full rounded-2xl bg-rose-600 py-3.5 text-lg font-semibold text-white shadow disabled:opacity-40"
      >
        시작
      </button>
    </div>
  )
}
