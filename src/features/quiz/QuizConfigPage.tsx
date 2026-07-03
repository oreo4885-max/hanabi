import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { useSession, type QuizMode } from '../../stores/session'
import { useTts } from '../../lib/useTts'

const MODES: { mode: QuizMode; label: string; desc: string; needsTts?: boolean }[] = [
  { mode: 'word-to-meaning', label: '뜻 고르기', desc: '일본어 단어를 보고 한국어 뜻 선택' },
  { mode: 'meaning-to-word', label: '단어 고르기', desc: '한국어 뜻을 보고 일본어 단어 선택' },
  { mode: 'typed', label: '주관식 (읽기 입력)', desc: '단어를 보고 읽기(가나)를 직접 입력' },
  { mode: 'dictation', label: '받아쓰기 (듣기)', desc: '발음을 듣고 가나로 받아쓰기', needsTts: true },
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

  function start() {
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
        className="w-full rounded-2xl bg-rose-600 py-3.5 text-lg font-semibold text-white shadow"
      >
        시작
      </button>
    </div>
  )
}
