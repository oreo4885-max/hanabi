import { Component, type ErrorInfo, type ReactNode } from 'react'

/** 초기 데이터 준비 중 표시 (백지 화면 방지) */
export function AppLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl">🎆</p>
      <p className="font-bold">하나비</p>
      <p className="text-sm text-slate-400">학습 데이터를 준비하는 중…</p>
      <p className="text-xs text-slate-300">처음 실행하거나 업데이트한 뒤에는 조금 걸릴 수 있어요.</p>
    </div>
  )
}

/** 앱을 처음부터 다시 받아온다 (캐시·서비스워커 정리 후 새로고침) */
async function hardReset() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* 정리에 실패해도 새로고침은 시도한다 */
  }
  window.location.reload()
}

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 화면 렌더 중 오류가 나도 백지로 두지 않고 복구 수단을 준다.
 * (대부분 새 배포 직후 옛 캐시가 남아 생기는 문제)
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('앱 오류:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-5xl">😵</p>
        <h1 className="text-lg font-bold">화면을 불러오지 못했습니다</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          업데이트 직후 일시적으로 생길 수 있는 문제입니다.
          <br />
          아래 버튼을 누르면 최신 버전을 다시 받아옵니다.
          <br />
          <b>학습 기록은 지워지지 않습니다.</b>
        </p>
        <button
          type="button"
          onClick={() => void hardReset()}
          className="rounded-xl bg-rose-600 px-6 py-3 font-bold text-white"
        >
          앱 새로 받기
        </button>
        <p className="max-w-xs break-all text-[11px] text-slate-300">{this.state.error.message}</p>
      </div>
    )
  }
}
