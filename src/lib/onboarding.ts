/**
 * 온보딩 완료 플래그(기기 로컬).
 * DB(settings.onboarded)가 정본이지만, 그 반영은 비동기라
 * 온보딩 완료 직후 화면 전환에서 리다이렉트가 되튀는 것을 막기 위해 동기 플래그를 함께 쓴다.
 */
export const ONBOARDED_FLAG = 'hanabi:onboarded'

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_FLAG, '1')
  } catch {
    // 프라이빗 모드 등 localStorage 불가 환경 — DB 플래그로만 동작
  }
}

export function clearOnboarded(): void {
  try {
    localStorage.removeItem(ONBOARDED_FLAG)
  } catch {
    /* noop */
  }
}
