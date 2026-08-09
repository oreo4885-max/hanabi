import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Level } from '../../db/schema'
import { addDays, todayStr } from '../../lib/dates'
import { bestStreak, currentStreak } from '../../lib/streak'
import { deckIdsForTarget } from '../../lib/levels'
import { DEFAULT_TARGET_LEVEL, WEAK_LAPSES } from '../../srs/queue'
import { getSetting } from '../../db/schema'

const DAYS = 30
/** 이 간격 이상으로 벌어진 카드는 '숙지'로 본다 (Anki의 mature 기준) */
const MATURE_DAYS = 21
/** 복습 정답률 집계 범위 (최근 N회) */
const RECENT_LOGS = 5000

interface DeckStat {
  id: string
  name: string
  level: Level | null
  total: number
  started: number
  mature: number
}

export default function StatsPage() {
  const data = useLiveQuery(async () => {
    const target = await getSetting<Level>('targetLevel', DEFAULT_TARGET_LEVEL)
    const inTarget = new Set(deckIdsForTarget(target))

    const [days, decks] = await Promise.all([db.dailyStats.toArray(), db.decks.toArray()])

    // 덱별 진행 + 카드 상태 집계 (한 번의 순회로)
    const perDeck = new Map<string, { started: number; mature: number }>()
    let newN = 0
    let learnN = 0
    let youngN = 0
    let matureN = 0
    let weakN = 0
    await db.srs.each((s) => {
      const st = perDeck.get(s.deckId) ?? { started: 0, mature: 0 }
      const isMature = s.state === 'review' && s.intervalDays >= MATURE_DAYS
      if (s.state !== 'new') {
        st.started++
        if (isMature) st.mature++
      }
      perDeck.set(s.deckId, st)

      if (!inTarget.has(s.deckId)) return
      if (s.state === 'new') newN++
      else if (s.state === 'learning') learnN++
      else if (isMature) matureN++
      else youngN++
      if (s.lapses >= WEAK_LAPSES) weakN++
    })

    // 복습 정답률: grade 0(다시)만 오답으로 본다.
    // 기록이 계속 쌓이므로 전체가 아닌 최근 분량만 집계해 화면이 느려지지 않게 한다.
    const recent = await db.reviewLog.orderBy('reviewedAt').reverse().limit(RECENT_LOGS).toArray()
    const graded = recent.length
    const again = recent.reduce((n, l) => n + (l.grade === 0 ? 1 : 0), 0)

    const deckStats: DeckStat[] = decks
      .filter((d) => inTarget.has(d.id) || d.source === 'custom')
      .map((d) => ({
        id: d.id,
        name: d.name.replace('JLPT ', ''),
        level: d.level,
        total: d.cardCount,
        started: perDeck.get(d.id)?.started ?? 0,
        mature: perDeck.get(d.id)?.mature ?? 0,
      }))
      .sort((a, b) => b.started / (b.total || 1) - a.started / (a.total || 1))

    return {
      days,
      target,
      counts: { newN, learnN, youngN, matureN, weakN },
      review: { graded, again },
      deckStats,
    }
  }, [])

  if (!data) return <p className="text-sm text-slate-400">불러오는 중…</p>

  const { days, target, counts, review, deckStats } = data
  const { newN, learnN, youngN, matureN, weakN } = counts
  const total = newN + learnN + youngN + matureN

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
  const quizAcc = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null
  const reviewAcc = review.graded > 0 ? Math.round(((review.graded - review.again) / review.graded) * 100) : null

  const masteredPct = total > 0 ? Math.round((matureN / total) * 100) : 0
  const startedPct = total > 0 ? Math.round(((total - newN) / total) * 100) : 0

  const W = 300
  const H = 96
  const bw = W / DAYS

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">통계</h1>
        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 ring-1 ring-rose-100">
          목표 {target}
        </span>
      </header>

      {/* 전체 진도율 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">전체 진도 ({total}장)</h2>
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tabular-nums text-rose-600">{startedPct}%</span>
          <span className="text-sm text-slate-400">학습 시작 · 숙지 {masteredPct}%</span>
        </p>
        {total > 0 && (
          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full">
            <div style={{ width: `${(matureN / total) * 100}%` }} className="bg-emerald-500" title="숙지" />
            <div style={{ width: `${(youngN / total) * 100}%` }} className="bg-emerald-300" title="복습 중" />
            <div style={{ width: `${(learnN / total) * 100}%` }} className="bg-amber-400" title="학습 중" />
            <div style={{ width: `${(newN / total) * 100}%` }} className="bg-slate-200" title="미학습" />
          </div>
        )}
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-emerald-600">● 숙지 (21일 이상 기억)</span>
            <b>{matureN}</b>
          </p>
          <p className="flex justify-between">
            <span className="text-emerald-400">● 복습 중</span>
            <b>{youngN}</b>
          </p>
          <p className="flex justify-between">
            <span className="text-amber-500">● 학습 중</span>
            <b>{learnN}</b>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-400">● 미학습</span>
            <b>{newN}</b>
          </p>
        </div>
      </section>

      {/* 정답률 */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">복습 정답률</p>
          <p className="text-2xl font-bold text-emerald-600">
            {reviewAcc === null ? '–' : `${reviewAcc}%`}
          </p>
          <p className="text-xs text-slate-400">
            최근 {review.graded}회 중 오답 {review.again}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">퀴즈 정답률</p>
          <p className="text-2xl font-bold text-rose-600">
            {quizAcc === null ? '–' : `${quizAcc}%`}
          </p>
          <p className="text-xs text-slate-400">
            {quizTotal}문제 중 {quizCorrect}개
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">연속 학습</p>
          <p className="text-2xl font-bold text-amber-500">{currentStreak(days)}일</p>
          <p className="text-xs text-slate-400">최고 {bestStreak(days)}일</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">취약 항목</p>
          <p className="text-2xl font-bold text-red-500">{weakN}</p>
          <p className="text-xs text-slate-400">2회 이상 틀림</p>
        </div>
      </section>

      {/* 학습량 추이 */}
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

      {/* 덱별 숙지율 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">덱별 진도</h2>
        <ul className="space-y-3">
          {deckStats.map((d) => {
            const startedPctD = d.total > 0 ? (d.started / d.total) * 100 : 0
            const maturePctD = d.total > 0 ? (d.mature / d.total) * 100 : 0
            return (
              <li key={d.id}>
                <p className="flex items-baseline justify-between text-sm">
                  <b className="truncate">{d.name}</b>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">
                    {d.started}/{d.total} · 숙지 {d.mature}
                  </span>
                </p>
                <span className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full bg-emerald-500" style={{ width: `${maturePctD}%` }} />
                  <span
                    className="block h-full bg-rose-400"
                    style={{ width: `${Math.max(0, startedPctD - maturePctD)}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">
          <span className="text-emerald-600">■</span> 숙지 · <span className="text-rose-400">■</span> 학습
          중 — 목표 레벨({target}) 범위만 표시됩니다.
        </p>
      </section>
    </div>
  )
}
