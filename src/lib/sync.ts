import { db, LOCAL_ONLY_SETTING, type DailyStats, type SrsState } from '../db/schema'
import { supabase } from './supabase'

const LAST_SYNC_KEY = 'sync:lastAt'
/** 한 번에 올리는 행 수 (URL/페이로드 한도 회피) */
const CHUNK = 500

export interface SyncResult {
  pushed: number
  pulled: number
  at: number
}

async function getLastSync(): Promise<number> {
  const row = await db.settings.get(LAST_SYNC_KEY)
  return (row?.value as number | undefined) ?? 0
}

async function setLastSync(at: number): Promise<void> {
  // sync:* 는 계정 동기화 대상이 아니므로 updatedAt 없이 직접 기록
  await db.settings.put({ key: LAST_SYNC_KEY, value: at })
}

function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── 로컬 → 서버 ──────────────────────────────────────────

async function pushSrs(userId: string, since: number): Promise<number> {
  const rows = await db.srs.filter((s) => (s.updatedAt ?? 0) > since).toArray()
  if (rows.length === 0) return 0
  for (const part of chunk(rows)) {
    const payload = part.map((s) => ({
      user_id: userId,
      card_id: s.cardId,
      deck_id: s.deckId,
      state: s.state,
      ef: s.ef,
      interval_days: s.intervalDays,
      step_index: s.stepIndex,
      reps: s.reps,
      lapses: s.lapses,
      due_at: s.dueAt,
      last_reviewed_at: s.lastReviewedAt,
      stability: s.stability ?? null,
      difficulty: s.difficulty ?? null,
      scheduled_days: s.scheduledDays ?? null,
      learning_steps: s.learningSteps ?? null,
      fsrs_state: s.fsrsState ?? null,
      updated_at: s.updatedAt ?? Date.now(),
    }))
    const { error } = await supabase.from('srs_progress').upsert(payload, {
      onConflict: 'user_id,card_id',
    })
    if (error) throw error
  }
  return rows.length
}

async function pushStats(userId: string, since: number): Promise<number> {
  const rows = await db.dailyStats.filter((d) => (d.updatedAt ?? 0) > since).toArray()
  if (rows.length === 0) return 0
  const payload = rows.map((d) => ({
    user_id: userId,
    date: d.date,
    reviews: d.reviews,
    new_cards: d.newCards,
    quiz_total: d.quizTotal,
    quiz_correct: d.quizCorrect,
    micro_sessions: d.microSessions,
    study_seconds: d.studySeconds,
    updated_at: d.updatedAt ?? Date.now(),
  }))
  const { error } = await supabase.from('daily_stats').upsert(payload, {
    onConflict: 'user_id,date',
  })
  if (error) throw error
  return rows.length
}

async function pushSettings(userId: string, since: number): Promise<number> {
  const rows = (await db.settings.toArray()).filter(
    (s) => !LOCAL_ONLY_SETTING(s.key) && (s.updatedAt ?? 0) > since,
  )
  if (rows.length === 0) return 0
  const payload = rows.map((s) => ({
    user_id: userId,
    key: s.key,
    value: s.value as never,
    updated_at: s.updatedAt ?? Date.now(),
  }))
  const { error } = await supabase.from('user_settings').upsert(payload, {
    onConflict: 'user_id,key',
  })
  if (error) throw error
  return rows.length
}

// ── 서버 → 로컬 ──────────────────────────────────────────

async function pullSrs(since: number): Promise<number> {
  const { data, error } = await supabase
    .from('srs_progress')
    .select('*')
    .gt('updated_at', since)
  if (error) throw error
  if (!data || data.length === 0) return 0

  const ids = data.map((r) => r.card_id as string)
  const locals = await db.srs.bulkGet(ids)
  const toPut: SrsState[] = []
  data.forEach((r, i) => {
    const local = locals[i]
    const remoteAt = Number(r.updated_at ?? 0)
    // 로컬이 더 최신이면 서버 값을 덮어쓰지 않는다 (다음 push에서 서버가 갱신됨)
    if (local && (local.updatedAt ?? 0) >= remoteAt) return
    toPut.push({
      cardId: r.card_id as string,
      deckId: r.deck_id as string,
      state: r.state as SrsState['state'],
      ef: Number(r.ef ?? 2.5),
      intervalDays: Number(r.interval_days ?? 0),
      stepIndex: Number(r.step_index ?? 0),
      reps: Number(r.reps ?? 0),
      lapses: Number(r.lapses ?? 0),
      dueAt: Number(r.due_at ?? 0),
      lastReviewedAt: r.last_reviewed_at === null ? null : Number(r.last_reviewed_at),
      stability: r.stability === null ? undefined : Number(r.stability),
      difficulty: r.difficulty === null ? undefined : Number(r.difficulty),
      scheduledDays: r.scheduled_days === null ? undefined : Number(r.scheduled_days),
      learningSteps: r.learning_steps === null ? undefined : Number(r.learning_steps),
      fsrsState: r.fsrs_state === null ? undefined : Number(r.fsrs_state),
      updatedAt: remoteAt,
    })
  })
  if (toPut.length > 0) await db.srs.bulkPut(toPut)
  return toPut.length
}

async function pullStats(since: number): Promise<number> {
  const { data, error } = await supabase.from('daily_stats').select('*').gt('updated_at', since)
  if (error) throw error
  if (!data || data.length === 0) return 0

  const toPut: DailyStats[] = []
  for (const r of data) {
    const date = r.date as string
    const local = await db.dailyStats.get(date)
    const remoteAt = Number(r.updated_at ?? 0)
    if (local && (local.updatedAt ?? 0) >= remoteAt) continue
    toPut.push({
      date,
      reviews: Number(r.reviews ?? 0),
      newCards: Number(r.new_cards ?? 0),
      quizTotal: Number(r.quiz_total ?? 0),
      quizCorrect: Number(r.quiz_correct ?? 0),
      microSessions: Number(r.micro_sessions ?? 0),
      studySeconds: Number(r.study_seconds ?? 0),
      updatedAt: remoteAt,
    })
  }
  if (toPut.length > 0) await db.dailyStats.bulkPut(toPut)
  return toPut.length
}

async function pullSettings(since: number): Promise<number> {
  const { data, error } = await supabase.from('user_settings').select('*').gt('updated_at', since)
  if (error) throw error
  if (!data || data.length === 0) return 0

  let n = 0
  for (const r of data) {
    const key = r.key as string
    if (LOCAL_ONLY_SETTING(key)) continue
    const local = await db.settings.get(key)
    const remoteAt = Number(r.updated_at ?? 0)
    if (local && (local.updatedAt ?? 0) >= remoteAt) continue
    await db.settings.put({ key, value: r.value, updatedAt: remoteAt })
    n++
  }
  return n
}

// ── 공개 API ────────────────────────────────────────────

/**
 * 양방향 동기화. 마지막 동기화 이후 변경분만 주고받고,
 * 충돌은 updatedAt이 큰 쪽이 이긴다(last-write-wins).
 */
export async function syncNow(): Promise<SyncResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const since = await getLastSync()
  const startedAt = Date.now()

  // 먼저 올리고 → 내려받아야 이 기기의 최신 변경이 서버 값에 덮이지 않는다
  const pushed =
    (await pushSrs(userId, since)) +
    (await pushStats(userId, since)) +
    (await pushSettings(userId, since))

  const pulled = (await pullSrs(since)) + (await pullStats(since)) + (await pullSettings(since))

  await setLastSync(startedAt)
  return { pushed, pulled, at: startedAt }
}

/**
 * 첫 로그인 등 계정이 바뀐 뒤의 전체 동기화.
 * 로컬 전체를 서버에 올리고 서버 전체를 병합한다.
 */
export async function fullSync(): Promise<SyncResult> {
  await setLastSync(0)
  return syncNow()
}

/** 로그아웃 시 다음 로그인에서 전체 동기화가 일어나도록 초기화 */
export async function resetSyncCursor(): Promise<void> {
  await setLastSync(0)
}
