import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDueCounts } from '../../srs/queue'
import { db } from '../../db/schema'
import { currentStreak } from '../../lib/streak'

export default function DashboardPage() {
  const counts = useLiveQuery(async () => {
    // dailyStats/srs 변경 시 재계산되도록 테이블을 live query 안에서 조회
    return getDueCounts()
  }, [])

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">하나비 🎆</h1>
        <p className="text-sm text-slate-500">JLPT 단어, 하루 조금씩.</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">복습 대기</p>
          <p className="text-3xl font-bold text-rose-600">{counts?.due ?? '–'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">새 단어</p>
          <p className="text-3xl font-bold text-emerald-600">{counts?.fresh ?? '–'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">연속 학습</p>
          <p className="text-3xl font-bold text-amber-500">
            {streak === undefined ? '–' : `${streak}일`}
          </p>
        </div>
      </section>

      {backupDue && (
        <Link
          to="/settings"
          className="block rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100"
        >
          💾 마지막 백업 후 30일이 지났습니다. 설정에서 백업 파일을 내려받아 두세요 →
        </Link>
      )}

      <section className="space-y-3">
        <Link to="/review" className="block rounded-2xl bg-rose-600 p-4 text-center text-lg font-semibold text-white shadow">
          복습 시작
        </Link>
        <Link to="/quiz" className="block rounded-2xl bg-white p-4 text-center text-lg font-semibold text-rose-600 shadow-sm">
          퀴즈 풀기
        </Link>
        <Link to="/micro" className="block rounded-2xl bg-white p-4 text-center text-lg font-semibold text-amber-500 shadow-sm">
          ⚡ 26초 학습
        </Link>
      </section>
    </div>
  )
}
