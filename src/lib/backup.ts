import { db, setSetting } from '../db/schema'

export interface BackupFile {
  app: 'hanabi'
  schema: number
  exportedAt: number
  tables: {
    decks: unknown[]
    cards: unknown[]
    srs: unknown[]
    reviewLog: unknown[]
    dailyStats: unknown[]
    settings: unknown[]
  }
}

export async function buildBackup(): Promise<BackupFile> {
  const [decks, cards, srs, reviewLog, dailyStats, settings] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.srs.toArray(),
    db.reviewLog.toArray(),
    db.dailyStats.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: 'hanabi',
    schema: 1,
    exportedAt: Date.now(),
    tables: { decks, cards, srs, reviewLog, dailyStats, settings },
  }
}

/** JSON 백업 파일 다운로드 트리거 */
export async function downloadBackup(): Promise<void> {
  const data = await buildBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `hanabi-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
  await setSetting('lastBackupAt', Date.now())
}

export function validateBackup(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d.app !== 'hanabi' || typeof d.schema !== 'number') return false
  const t = d.tables as Record<string, unknown> | undefined
  if (!t) return false
  return ['decks', 'cards', 'srs', 'reviewLog', 'dailyStats', 'settings'].every((k) =>
    Array.isArray(t[k]),
  )
}

/** 백업 파일로 전체 복원 (기존 데이터를 완전히 대체) */
export async function importBackup(json: string): Promise<{ cards: number; reviews: number }> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('JSON 파일을 읽을 수 없습니다.')
  }
  if (!validateBackup(data)) throw new Error('하나비 백업 파일이 아닙니다.')

  const t = data.tables
  await db.transaction(
    'rw',
    [db.decks, db.cards, db.srs, db.reviewLog, db.dailyStats, db.settings],
    async () => {
      await Promise.all([
        db.decks.clear(),
        db.cards.clear(),
        db.srs.clear(),
        db.reviewLog.clear(),
        db.dailyStats.clear(),
        db.settings.clear(),
      ])
      await db.decks.bulkAdd(t.decks as never[])
      await db.cards.bulkAdd(t.cards as never[])
      await db.srs.bulkAdd(t.srs as never[])
      await db.reviewLog.bulkAdd(
        // autoIncrement id 충돌 방지: id 제거 후 재부여
        (t.reviewLog as Record<string, unknown>[]).map(({ id: _id, ...rest }) => rest) as never[],
      )
      await db.dailyStats.bulkAdd(t.dailyStats as never[])
      await db.settings.bulkAdd(t.settings as never[])
    },
  )
  return { cards: t.cards.length, reviews: t.reviewLog.length }
}

/** 모든 데이터 삭제 후 초기 상태로 (시드는 새로고침 시 재실행) */
export async function resetAll(): Promise<void> {
  await db.delete()
  window.location.reload()
}
