import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Card } from '../../db/schema'
import { LESSONS, type DrillKind, type Lesson } from '../../grammar/lessons'
import {
  conjugateIAdj,
  conjugateNaAdj,
  conjugateVerb,
  detectGroup,
  FORM_LABELS,
  I_ADJ_FORM_LABELS,
  NA_ADJ_FORM_LABELS,
  type AdjForm,
  type NaAdjForm,
  type VerbForm,
} from '../../grammar/conjugate'
import { isCorrectKana } from '../../lib/kana'

const DRILL_LEN = 10

interface DrillQ {
  prompt: string // 사전형 (한자)
  kana: string
  ko: string
  targetLabel: string
  /** 정답들 (한자형·가나형) */
  answers: string[]
  /** 그룹 판별 문제일 때 정답 그룹 */
  group?: 1 | 2 | 3
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const VERB_ENDINGS = /[うくぐすつぬぶむる]$/

function cleanWord(c: Card): boolean {
  return !c.kanji.includes(';') && !c.kanji.includes('～') && !c.kanji.includes('〜') && !c.kanji.includes(' ')
}

async function buildDrill(kind: DrillKind): Promise<DrillQ[]> {
  if (kind === 'iadj' || kind === 'naadj') {
    const pos = kind === 'iadj' ? 'い형용사' : 'な형용사'
    const pool = (await db.cards.filter((c) => c.pos === pos && (c.level === 'N5' || c.level === 'N4')).toArray()).filter(cleanWord)
    return shuffle(pool)
      .slice(0, DRILL_LEN)
      .map((c) => {
        const forms = kind === 'iadj' ? I_ADJ_FORM_LABELS : NA_ADJ_FORM_LABELS
        const keys = Object.keys(forms) as (AdjForm | NaAdjForm)[]
        const f = keys[Math.floor(Math.random() * keys.length)]
        const conj = kind === 'iadj' ? conjugateIAdj : conjugateNaAdj
        return {
          prompt: c.kanji,
          kana: c.kana,
          ko: c.ko,
          targetLabel: (forms as Record<string, string>)[f],
          answers: [conj(c.kanji, f as never), conj(c.kana, f as never)],
        }
      })
  }

  // 동사 드릴
  const verbs = (await db.cards.filter((c) => c.pos === '동사' && (c.level === 'N5' || c.level === 'N4')).toArray())
    .filter(cleanWord)
    .filter((c) => VERB_ENDINGS.test(c.kana))
  const picked = shuffle(verbs).slice(0, DRILL_LEN)

  if (kind === 'group') {
    return picked.map((c) => ({
      prompt: c.kanji,
      kana: c.kana,
      ko: c.ko,
      targetLabel: '그룹 판별',
      answers: [],
      group: detectGroup(c.kanji, c.kana),
    }))
  }

  const form = kind as VerbForm
  return picked.map((c) => {
    const g = detectGroup(c.kanji, c.kana)
    return {
      prompt: c.kanji,
      kana: c.kana,
      ko: c.ko,
      targetLabel: FORM_LABELS[form],
      answers: [conjugateVerb(c.kanji, g, form), conjugateVerb(c.kana, g, form)],
    }
  })
}

export default function GrammarPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [drill, setDrill] = useState<DrillQ[] | null>(null)
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<null | { ok: boolean; answer: string }>(null)
  const composing = useRef(false)

  async function startDrill(l: Lesson) {
    const qs = await buildDrill(l.drill)
    setDrill(qs)
    setQi(0)
    setScore(0)
    setTyped('')
    setFeedback(null)
  }

  function submitTyped() {
    if (!drill || feedback || composing.current) return
    const q = drill[qi]
    const input = typed.normalize('NFKC').trim()
    const ok =
      q.answers.some((a) => a === input) || q.answers.some((a) => isCorrectKana(input, a))
    if (ok) setScore((s) => s + 1)
    setFeedback({ ok, answer: `${q.answers[0]}${q.answers[1] !== q.answers[0] ? ` (${q.answers[1]})` : ''}` })
  }

  function pickGroup(g: 1 | 2 | 3) {
    if (!drill || feedback) return
    const q = drill[qi]
    const ok = q.group === g
    if (ok) setScore((s) => s + 1)
    const names = { 1: '1그룹(오단)', 2: '2그룹(일단)', 3: '3그룹(불규칙)' }
    setFeedback({ ok, answer: names[q.group!] })
  }

  function next() {
    setFeedback(null)
    setTyped('')
    setQi((i) => i + 1)
  }

  // ── 드릴 화면 ──
  if (lesson && drill) {
    const q = drill[qi]
    if (!q) {
      return (
        <div className="flex flex-col items-center gap-4 pt-14 text-center">
          <p className="text-5xl">{score === drill.length ? '🏆' : '✍️'}</p>
          <p className="text-lg font-bold">
            {score} / {drill.length} 정답
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void startDrill(lesson)} className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white">
              한 번 더
            </button>
            <button type="button" onClick={() => setDrill(null)} className="rounded-xl bg-white px-5 py-2.5 font-semibold text-slate-500 ring-1 ring-slate-200">
              레슨으로
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between text-sm text-slate-400">
          <button type="button" onClick={() => setDrill(null)}>← {lesson.title}</button>
          <span>
            {qi + 1} / {drill.length} · 맞힘 {score}
          </span>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-ja-display text-5xl leading-tight">{q.prompt}</p>
          {q.kana !== q.prompt && <p className="mt-2 font-ja text-lg text-slate-400">{q.kana}</p>}
          <p className="mt-1 text-sm text-slate-500">{q.ko}</p>
          <p className="mt-3 inline-block rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600 ring-1 ring-rose-100">
            {q.targetLabel}
          </p>
        </div>

        {lesson.drill === 'group' ? (
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => pickGroup(g)}
                className="rounded-xl border border-slate-200 bg-white py-3.5 font-bold"
              >
                {g}그룹
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={() => (composing.current = false)}
              onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
              disabled={!!feedback}
              placeholder="활용형을 입력 (가나 또는 한자, 로마자 OK)"
              className="w-full rounded-xl border border-rose-100 bg-white px-4 py-3 font-ja text-lg outline-none focus:border-rose-300"
              autoFocus
            />
            {!feedback && (
              <button type="button" onClick={submitTyped} className="w-full rounded-xl bg-rose-600 py-3 font-bold text-white">
                제출
              </button>
            )}
          </div>
        )}

        {feedback && (
          <div className={`rounded-2xl p-4 ${feedback.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className={`font-bold ${feedback.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {feedback.ok ? '정답! ⭕' : '오답 ❌'}
            </p>
            <p className="mt-1 font-ja text-lg">{feedback.answer}</p>
            <button type="button" onClick={next} className="mt-3 w-full rounded-xl bg-slate-800 py-3 font-bold text-white">
              다음
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── 레슨 상세 ──
  if (lesson) {
    return (
      <div className="space-y-4">
        <header>
          <button type="button" onClick={() => setLesson(null)} className="text-xs text-slate-400">
            ← 문법 목록
          </button>
          <h1 className="text-xl font-bold">
            {lesson.title} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{lesson.level}</span>
          </h1>
        </header>

        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-100">
          💡 {lesson.tip}
        </p>

        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {lesson.rows.map((r) => (
            <div key={r.rule} className="px-4 py-3">
              <p className="text-sm font-semibold">{r.rule}</p>
              <p className="mt-0.5 font-ja text-sm text-slate-500">{r.example}</p>
            </div>
          ))}
        </div>

        {lesson.drill !== 'none' && (
          <button
            type="button"
            onClick={() => void startDrill(lesson)}
            className="w-full rounded-2xl bg-rose-600 py-3.5 text-lg font-bold text-white"
          >
            ✍️ 드릴 10문제
          </button>
        )}
      </div>
    )
  }

  // ── 목록 ──
  return (
    <div className="space-y-4">
      <header>
        <Link to="/" className="text-xs text-slate-400">
          ← 홈
        </Link>
        <h1 className="text-xl font-bold">문법 — 활용 훈련</h1>
        <p className="mt-1 text-xs text-slate-400">규칙을 1분 읽고, 실제 단어로 무한 반복 연습하세요.</p>
      </header>
      <ul className="space-y-2">
        {LESSONS.map((l, i) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => setLesson(l)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left"
            >
              <span>
                <span className="font-bold">{i + 1}. {l.title}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{l.level}</span>
              </span>
              <span className="text-slate-300">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
