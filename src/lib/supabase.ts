import { createClient } from '@supabase/supabase-js'

// anon key는 공개용 키다. 실제 접근 제어는 Supabase 테이블의 RLS 정책이 담당한다.
const SUPABASE_URL = 'https://clupvodwpjquafnqrsdc.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdXB2b2R3cGpxdWFmbnFyc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNzIwNjMsImV4cCI6MjEwMTg0ODA2M30.X_Ll2UqrrMcHIu_xxUpNfooW2eyPBat3Rkk4B8gEP2U'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // OTP(숫자 코드) 방식이라 URL 해시로 세션이 오지 않는다
    detectSessionInUrl: false,
  },
})

/**
 * 이메일로 인증번호 발송 (계정이 없으면 자동 생성).
 * 자릿수는 Supabase 프로젝트 설정값을 따른다 (6~10자리, 현재 8자리).
 */
export async function sendOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** 인증번호 검증 후 로그인 */
export async function verifyOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Supabase 에러 메시지를 한국어로 */
export function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/rate limit|too many requests|429/i.test(msg))
    return '인증 메일 발송 한도를 넘었습니다. 잠시 후(최대 1시간) 다시 시도해 주세요.'
  if (/invalid|expired|token/i.test(msg)) return '인증번호가 올바르지 않거나 만료되었습니다.'
  if (/email/i.test(msg) && /invalid/i.test(msg)) return '이메일 주소를 확인해 주세요.'
  if (/network|fetch/i.test(msg)) return '네트워크 연결을 확인해 주세요.'
  return `오류가 발생했습니다: ${msg}`
}
