import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDueCounts } from '../../srs/queue'
import { db, getSetting } from '../../db/schema'
import { currentStreak } from '../../lib/streak'
import { todayStr } from '../../lib/dates'
import ProgressRing from '../../components/ProgressRing'

interface DeckProgress {
  id: string
  name: string
  level: string | null
  total: number
  learned: number
  due: number
}

export default function DashboardPage() {
  const counts = useLiveQuery(async () => getDueCounts(), [])

  const streak = useLiveQuery(async () => {
    const days = await db.dailyStats.toArray()
    return currentStreak(days)
  }, [])

  const doneToday = useLiveQuery(async () => {
    const today = await db.dailyStats.get(todayStr())
    return today?.reviews ?? 0
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

  // 레벨별 덱 진행 현황 (이로이로식)
  const decks = useLiveQuery(async () => {
    const now = Date.now()
    const allDecks = await db.decks.toArray()
    const stats = new Map<string, { learned: number; due: number }>()
    await db.srs.each((s) => {
      const st = stats.get(s.deckId) ?? { learned: 0, due: 0 }
      if (s.state !== 'new') {
        st.learned++
        if (s.dueAt <= now) st.due++
      }
      stats.set(s.deckId, st)
    })
    const order = ['jlpt-n5', 'jlpt-n4', 'jlpt-n3', 'jlpt-n2', 'jlpt-n1', 'grammar-n5', 'grammar-n4', 'grammar-n3', 'grammar-n2', 'grammar-n1']
    return allDecks
      .map<DeckProgress>((d) => ({
        id: d.id,
        name: d.name,
        level: d.level,
        total: d.cardCount,
        learned: stats.get(d.id)?.learned ?? 0,
        due: stats.get(d.id)?.due ?? 0,
      }))
      .sort((a, b) => {
        const ai = order.indexOf(a.id)
        const bi = order.indexOf(b.id)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
  }, [])

  const [showAllDecks, setShowAllDecks] = useState(false)
  const remaining = counts ? counts.due + counts.fresh : null

  function renderDeckRow(d: DeckProgress) {
    const pct = d.total > 0 ? Math.round((d.learned / d.total) * 100) : 0
    return (
      <li key={d.id}>
        <Link to={`/review?deck=${d.id}`} className="flex items-center gap-3 px-4 py-3">
          <span className="w-8 shrink-0 rounded-lg bg-rose-50 py-1 text-center text-xs font-extrabold text-rose-600 ring-1 ring-rose-100">
            {d.level ?? '—'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between text-sm">
              <b className="truncate">{d.name.replace('JLPT ', '')}</b>
              <span className="ml-2 shrink-0 text-xs text-slate-400">
                {d.learned}/{d.total} · {pct}%
              </span>
            </span>
            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
            </span>
          </span>
          {d.due > 0 && (
            <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {d.due}
            </span>
          )}
        </Link>
      </li>
    )
  }
  const goalTotal = (doneToday ?? 0) + (remaining ?? 0)
  const progress = goalTotal > 0 ? (doneToday ?? 0) / goalTotal : 1
  const allDone = remaining === 0

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold tracking-tight">하나비 🎆</h1>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
          ⚡ {streak === undefined ? '–' : streak}일 연속
        </span>
      </header>

      {/* 오늘의 목표 (이로이로식 링) */}
      <section className="flex items-center gap-5 rounded-3xl border border-slate-200 bg-white p-5">
        <ProgressRing progress={progress} size={92}>
          <span className="text-center leading-tight">
            <span className="block text-2xl font-extrabold tabular-nums">{doneToday ?? '–'}</span>
            <span className="block text-[10px] text-slate-400">/{goalTotal || '–'}장</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-400">오늘의 목표</p>
          {allDone ? (
            <p className="mt-1 text-xl font-extrabold">완료! 불꽃 터졌어요 🎆</p>
          ) : (
            <p className="mt-1 text-xl font-extrabold">
              <span className="text-rose-600">{remaining ?? '–'}</span>장 남음
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            복습 {counts?.due ?? '–'} · 새 카드 {counts?.fresh ?? '–'}
          </p>
          <Link
            to="/review"
            className="mt-2.5 inline-block rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white"
          >
            {allDone ? '더 학습하기' : '복습 시작'}
          </Link>
        </div>
      </section>

      {plan && plan.days > 0 && (
        <p className="rounded-xl bg-white p-3 text-xs text-slate-500 ring-1 ring-slate-200">
          🎯 시험까지 <b className="text-slate-800">D-{plan.days}</b> · 미학습 {plan.totalNew}장
          {plan.perDay !== null && (
            <>
              {' '}→ 하루 <b className="text-rose-600">{plan.perDay}장</b> 페이스
            </>
          )}
        </p>
      )}

      {backupDue && (
        <Link to="/settings" className="block rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100">
          💾 마지막 백업 후 30일이 지났습니다. 설정에서 백업해 두세요 →
        </Link>
      )}

      {/* 빠른 실행 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/micro" className="rounded-2xl bg-slate-800 p-3.5 text-center font-bold text-white">
          ⚡ 26초 스피드
        </Link>
        <Link to="/quiz" className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center font-bold text-slate-800">
          ✏️ 퀴즈
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Link to="/kana" className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-sm font-bold text-slate-500">
          <span className="font-ja">あ</span> 가나
        </Link>
        <Link to="/grammar" className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-sm font-bold text-slate-500">
          ✍️ 문법
        </Link>
        <Link to="/talk" className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-sm font-bold text-slate-500">
          🎧 회화
        </Link>
      </div>

      {/* 레벨별 진행 — 진행 중인 덱만 펼치고 나머지는 접기 */}
      {decks &&
        (() => {
          const active = decks.filter((d) => d.learned > 0)
          // 진행 중인 덱이 없으면(신규) 첫 덱만 노출하고 나머지는 접는다
          const shown = active.length > 0 ? active : decks.slice(0, 1)
          const shownIds = new Set(shown.map((d) => d.id))
          const hidden = decks.filter((d) => !shownIds.has(d.id))
          return (
            <section>
              <h2 className="mb-2 text-sm font-bold text-slate-500">
                {active.length > 0 ? '진행 중인 레벨' : '학습 시작하기'}
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {shown.map(renderDeckRow)}
              </ul>
              {hidden.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAllDecks((v) => !v)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-500"
                  >
                    {showAllDecks ? '접기 ▲' : `다른 레벨 ${hidden.length}개 ▼`}
                  </button>
                  {showAllDecks && (
                    <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {hidden.map(renderDeckRow)}
                    </ul>
                  )}
                </>
              )}
            </section>
          )
        })()}
    </div>
  )
}
