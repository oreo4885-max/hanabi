import { getSetting, setSetting } from '../db/schema'
import { getDueCounts } from '../srs/queue'

const MIN_INTERVAL_MS = 6 * 3600_000

/**
 * 복습 대기 카드가 있으면 브라우저 알림. 6시간에 1번만.
 * 브라우저가 실행 중일 때만 동작 — 완전한 푸시는 배포(HTTPS) 후 가능.
 */
export async function maybeNotifyDue(): Promise<void> {
  if (typeof Notification === 'undefined') return
  const enabled = await getSetting('reminderEnabled', false)
  if (!enabled || Notification.permission !== 'granted') return
  const last = await getSetting('lastReminderAt', 0)
  if (Date.now() - last < MIN_INTERVAL_MS) return
  const { due } = await getDueCounts()
  if (due === 0) return
  new Notification('하나비 🎆', {
    body: `복습 대기 ${due}장이 기다리고 있어요. 잠깐 불꽃 한 발!`,
    icon: '/pwa-192x192.png',
  })
  await setSetting('lastReminderAt', Date.now())
}

export function startReminderLoop(): void {
  // 앱이 열려 있는 동안 1시간마다 확인
  setInterval(() => void maybeNotifyDue(), 3600_000)
  void maybeNotifyDue()
}
