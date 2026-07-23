import { db, type Card, type DailyStats, type Grade, type StudyMode } from '../db/schema'
import { scheduleFsrs } from '../srs/fsrs'
import { todayStr } from './dates'

function emptyDay(date: string): DailyStats {
  return { date, reviews: 0, newCards: 0, quizTotal: 0, quizCorrect: 0, microSessions: 0, studySeconds: 0 }
}

export async function bumpDaily(patch: Partial<Omit<DailyStats, 'date'>>): Promise<void> {
  const date = todayStr()
  await db.transaction('rw', db.dailyStats, async () => {
    const row = (await db.dailyStats.get(date)) ?? emptyDay(date)
    for (const [k, v] of Object.entries(patch)) {
      ;(row as unknown as Record<string, number>)[k] += v as number
    }
    await db.dailyStats.put(row)
  })
}

/**
 * 평가 1건 처리: SRS 상태 전이 + 로그 + 일일 통계.
 * 반환값은 갱신된 SRS 상태 (세션 내 재등장 판단에 사용).
 */
export async function recordReview(card: Card, grade: Grade, mode: StudyMode, msToAnswer?: number) {
  const now = Date.now()
  const prev = await db.srs.get(card.id)
  if (!prev) return null
  const wasNew = prev.state === 'new'
  const next = scheduleFsrs(prev, grade, now)

  await db.transaction('rw', [db.srs, db.reviewLog, db.dailyStats], async () => {
    await db.srs.put(next)
    await db.reviewLog.add({
      cardId: card.id,
      reviewedAt: now,
      grade,
      mode,
      msToAnswer,
      newIntervalDays: next.intervalDays,
    })
    const date = todayStr()
    const row = (await db.dailyStats.get(date)) ?? emptyDay(date)
    row.reviews += 1
    if (wasNew) row.newCards += 1
    await db.dailyStats.put(row)
  })

  return next
}
