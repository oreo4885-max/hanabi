import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDueCounts } from '../../srs/queue'
import { db, getSetting } from '../../db/schema'
import { currentStreak } from '../../lib/streak'

export default function DashboardPage() {
  const counts = useLiveQuery(async () => getDueCounts(), [])

  const streak = useLiveQuery(async () => {
    const days = await db.dailyStats.toArray()
    return currentStreak(days)
  }, [])

  const backupDue = useLiveQuery(async () => {
    const [last, anyLog] = await Promise.all([
      db.settings.get('lastBackupAt'),
      db.reviewLog.limit(1).count(),
    ])
    if (anyLog === 0) return false
    const lastAt = (last?.value as number | undefined) ?? 0
    return Date.now() - lastAt > 30 * 86_400_000
  }, [])

  const plan = useLiveQuery(async () => {
    const examDate = await getSetting('examDate', '')
    if (!examDate) return null
    const days = Math.ceil((new Date(`${examDate}T23:59:59`).getTime() - Date.now()) / 86_400_000)
    const totalNew = await db.srs.where('state').equals('new').count()
    return { days, perDay: days > 0 ? Math.ceil(totalNew / days) : null, totalNew }
  }, [])

  const remaining = counts ? counts.due + counts.fresh : null
  const allDone = remaining === 0

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold tracking-tight">하나비 🎆</h1>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
          ⚡ {streak === undefined ? '–' : streak}일 연속
        </span>
      </header>

      {/* 오늘의 학습 히어로 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold text-slate-400">오늘 남은 학습</p>
        {allDone ? (
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            완료! <span className="text-rose-600">불꽃</span> 터졌어요 🎆
          </p>
        ) : (
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-6xl font-extrabold tabular-nums tracking-tighter">
              {remaining ?? '–'}
            </span>
            <span className="text-lg text-slate-400">단어</span>
          </p>
        )}
        <div className="mt-3 flex gap-4 text-sm text-slate-500">
          <span>
            복습 <b className="text-rose-600">{counts?.due ?? '–'}</b>
          </span>
          <span>
            새 단어 <b className="text-emerald-600">{counts?.fresh ?? '–'}</b>
          </span>
        </div>
        {plan && plan.days > 0 && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            🎯 시험까지 <b className="text-slate-800">D-{plan.days}</b> · 미학습 {plan.totalNew}단어
            {plan.perDay !== null && (
              <>
                {' '}
                → 하루 새 단어 <b className="text-rose-600">{plan.perDay}개</b> 페이스
              </>
            )}
          </p>
        )}
        {plan && plan.days <= 0 && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            🎯 시험일이 지났습니다. 설정에서 새 목표를 정해 보세요.
          </p>
        )}
      </section>

      {backupDue && (
        <Link
          to="/settings"
          className="block rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100"
        >
          💾 마지막 백업 후 30일이 지났습니다. 설정에서 백업 파일을 내려받아 두세요 →
        </Link>
      )}

      <section className="space-y-2.5">
        <Link
          to="/review"
          className="block rounded-2xl bg-rose-600 p-4 text-center text-lg font-bold text-white"
        >
          복습 시작
        </Link>
        <Link
          to="/micro"
          className="block rounded-2xl bg-slate-800 p-4 text-center text-lg font-bold text-white"
        >
          ⚡ 26초 스피드
        </Link>
        <Link
          to="/quiz"
          className="block rounded-2xl border border-slate-200 bg-white p-4 text-center text-lg font-bold text-slate-800"
        >
          퀴즈 풀기
        </Link>
      </section>
    </div>
  )
}
