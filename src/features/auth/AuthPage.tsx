import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authErrorMessage, sendOtp, verifyOtp } from '../../lib/supabase'
import { fullSync } from '../../lib/sync'

type Step = 'email' | 'code'

const RESEND_SEC = 60

/** Supabase 인증번호 길이는 프로젝트 설정에 따라 6~10자리다 (이 프로젝트는 8자리) */
const OTP_MIN = 6
const OTP_MAX = 10

export default function AuthPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_SEC)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timerRef.current) clearInterval(timerRef.current)
        return Math.max(0, c - 1)
      })
    }, 1000)
  }

  async function requestCode() {
    const addr = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await sendOtp(addr)
      setStep('code')
      setNotice(`${addr} 으로 인증번호를 보냈습니다.`)
      startCooldown()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode() {
    const token = code.replace(/\D/g, '')
    if (token.length < OTP_MIN) {
      setError(
        `인증번호가 짧습니다 (${token.length}자리 입력됨). 메일에 적힌 숫자를 끝까지 입력해 주세요.`,
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      await verifyOtp(email, token)
      setNotice('로그인 성공! 학습 기록을 동기화하는 중…')
      try {
        await fullSync()
      } catch {
        // 동기화 실패해도 로그인 자체는 유지 (설정에서 재시도 가능)
      }
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-sm flex-col justify-center gap-5">
      <header className="text-center">
        <p className="text-5xl">🎆</p>
        <h1 className="mt-2 text-2xl font-extrabold">
          {step === 'email' ? '로그인 / 회원가입' : '인증번호 입력'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === 'email'
            ? '이메일만 있으면 됩니다. 비밀번호는 필요 없어요.'
            : '메일함에서 인증번호를 확인해 주세요. 자동완성이 일부만 채우면 직접 입력하세요.'}
        </p>
      </header>

      {step === 'email' ? (
        <div className="space-y-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void requestCode()}
            placeholder="이메일 주소"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={busy}
            className="w-full rounded-xl bg-rose-600 py-3.5 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '보내는 중…' : '인증번호 받기'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            inputMode="numeric"
            /* one-time-code 자동완성은 6자리 코드를 전제로 동작해서
               8자리 인증번호의 앞 6자리만 채워 넣는다. 그래서 끈다. */
            autoComplete="off"
            maxLength={OTP_MAX}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_MAX))}
            onKeyDown={(e) => e.key === 'Enter' && void submitCode()}
            placeholder="인증번호"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.25em] outline-none focus:border-rose-400"
            autoFocus
          />
          {/* 자동완성이 일부만 채워 넣는 경우를 바로 알아챌 수 있게 자릿수를 보여준다 */}
          <p className="text-center text-xs text-slate-400">
            메일에 적힌 숫자를 <b>끝까지</b> 입력해 주세요 (보통 8자리)
            {code.length > 0 && (
              <span className={code.length >= OTP_MIN ? 'text-emerald-600' : 'text-slate-400'}>
                {' '}
                · {code.length}자리 입력됨
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void submitCode()}
            disabled={busy}
            className="w-full rounded-xl bg-rose-600 py-3.5 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '확인 중…' : '로그인'}
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => setStep('email')} className="text-slate-400 underline">
              이메일 다시 입력
            </button>
            <button
              type="button"
              onClick={() => void requestCode()}
              disabled={cooldown > 0 || busy}
              className="text-rose-600 underline disabled:text-slate-300 disabled:no-underline"
            >
              {cooldown > 0 ? `재발송 ${cooldown}초` : '인증번호 재발송'}
            </button>
          </div>
        </div>
      )}

      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2 text-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-slate-400 underline"
        >
          로그인 없이 계속 사용하기
        </button>
        <p className="text-[11px] leading-relaxed text-slate-400">
          로그인하면 학습 기록이 계정에 저장되어 다른 기기에서도 이어서 학습할 수 있습니다.
          <br />
          로그인 전 이 기기의 기록은 첫 로그인 시 계정으로 합쳐집니다.
        </p>
      </div>
    </div>
  )
}
