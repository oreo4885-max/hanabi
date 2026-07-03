import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { addDays, todayStr } from '../../lib/dates'
import { bestStreak, currentStreak } from '../../lib/streak'

const DAYS = 30

export default function StatsPage() {
  const data = useLiveQuery(async () => {
    const [days, states] = await Promise.all([
      db.dailyStats.toArray(),
      Promise.all([
        db.srs.where('state').equals('new').count(),
        db.srs.where('state').equals('learning').count(),
        db.srs.where('state').equals('review').count(),
      ]),
    ])
    return { days, states }
  }, [])

  if (!data) return <p className="text-sm text-slate-400">불러오는 중…</p>

  const { days, states } = data
  const [newN, learnN, reviewN] = states
  const total = newN + learnN + reviewN

  const byDate = new Map(days.map((d) => [d.date, d]))
  const today = todayStr()
  const series = Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(today, i - (DAYS - 1))
    const d = byDate.get(date)
    return { date, count: d ? d.reviews + d.quizTotal : 0 }
  })
  const max = Math.max(1, ...series.map((s) => s.count))

  const quizTotal = days.reduce((a, d) => a + d.quizTotal, 0)
  const quizCorrect = days.reduce((a, d) => a + d.quizCorrect, 0)
  const accuracy = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null

  const W = 300
  const H = 96
  const bw = W / DAYS

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">통계</h1>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">연속 학습</p>
          <p className="text-2xl font-bold text-amber-500">{currentStreak(days)}일</p>
          <p className="text-xs text-slate-400">최고 {bestStreak(days)}일</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">퀴즈 정답률</p>
          <p className="text-2xl font-bold text-rose-600">{accuracy === null ? '–' : `${accuracy}%`}</p>
          <p className="text-xs text-slate-400">{quizTotal}문제 중 {quizCorrect}개</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">최근 30일 학습량</h2>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {series.map((s, i) => {
            const h = (s.count / max) * (H - 12)
            return (
              <rect
                key={s.date}
                x={i * bw + 1}
                y={H - h}
                width={bw - 2}
                height={Math.max(h, s.count > 0 ? 2 : 0)}
                rx="1.5"
                fill={s.date === today ? '#e11d48' : '#fda4af'}
              />
            )
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{series[0].date.slice(5)}</span>
          <span>오늘</span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">카드 상태 ({total}장)</h2>
        {total > 0 && (
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            <div style={{ width: `${(reviewN / total) * 100}%` }} className="bg-emerald-500" />
            <div style={{ width: `${(learnN / total) * 100}%` }} className="bg-amber-400" />
            <div style={{ width: `${(newN / total) * 100}%` }} className="bg-slate-200" />
          </div>
        )}
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-emerald-600">● 복습 중</span>
            <span>{reviewN}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-amber-500">● 학습 중</span>
            <span>{learnN}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-400">● 미학습</span>
            <span>{newN}</span>
          </p>
        </div>
      </section>
    </div>
  )
}
