import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import BottomNav from './components/BottomNav'
import { db, setSetting } from './db/schema'
import { ONBOARDED_FLAG } from './lib/onboarding'

/**
 * 새 버전이 배포되면 옛 캐시에 남은 청크 주소가 404가 되어 화면이 열리지 않는다.
 * 그 경우 한 번만 새로고침해 최신 자산을 받아온다.
 */
const RELOAD_KEY = 'hanabi:chunk-reloaded'
function lazyPage<T extends { default: React.ComponentType<unknown> }>(load: () => Promise<T>) {
  return lazy(() =>
    load().catch((err) => {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
      }
      throw err
    }),
  )
}

const DashboardPage = lazyPage(() => import('./features/dashboard/DashboardPage'))
const DeckListPage = lazyPage(() => import('./features/decks/DeckListPage'))
const DeckDetailPage = lazyPage(() => import('./features/decks/DeckDetailPage'))
const ReviewPage = lazyPage(() => import('./features/review/ReviewPage'))
const QuizConfigPage = lazyPage(() => import('./features/quiz/QuizConfigPage'))
const QuizPlayPage = lazyPage(() => import('./features/quiz/QuizPlayPage'))
const MicroPage = lazyPage(() => import('./features/micro/MicroPage'))
const KanaPage = lazyPage(() => import('./features/kana/KanaPage'))
const TalkPage = lazyPage(() => import('./features/talk/TalkPage'))
const GrammarPage = lazyPage(() => import('./features/grammar/GrammarPage'))
const StatsPage = lazyPage(() => import('./features/stats/StatsPage'))
const SettingsPage = lazyPage(() => import('./features/settings/SettingsPage'))
const OnboardingPage = lazyPage(() => import('./features/onboarding/OnboardingPage'))
const AuthPage = lazyPage(() => import('./features/auth/AuthPage'))

/**
 * 온보딩 필요 여부: 아직 안 봤고 학습 이력도 없는 첫 사용자만.
 * DB 반영은 비동기라, 방금 온보딩을 끝낸 경우를 동기 플래그로 먼저 판정한다.
 */
function useNeedsOnboarding(): boolean | undefined {
  const justFinished = typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDED_FLAG) === '1'
  const fromDb = useLiveQuery(async () => {
    const flag = await db.settings.get('onboarded')
    if (flag?.value === true) return false
    const hasHistory = (await db.reviewLog.limit(1).count()) > 0
    if (hasHistory) {
      // 기존 사용자는 온보딩을 건너뛰고 다시 묻지 않는다
      await setSetting('onboarded', true)
      return false
    }
    return true
  }, [])

  if (justFinished) return false
  return fromDb
}

export default function App() {
  const location = useLocation()
  const needsOnboarding = useNeedsOnboarding()
  const onAuth = location.pathname === '/auth'
  const onOnboarding = location.pathname === '/onboarding'
  const fullscreen = onAuth || onOnboarding

  // 판정 전에는 깜빡임 방지를 위해 아무것도 그리지 않는다
  if (needsOnboarding === undefined) return null

  if (needsOnboarding && !fullscreen) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <main className={`flex-1 px-4 pt-6 ${fullscreen ? 'pb-6' : 'pb-24'}`}>
        <Suspense
          fallback={<p className="pt-16 text-center text-sm text-slate-400">불러오는 중…</p>}
        >
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/decks" element={<DeckListPage />} />
            <Route path="/decks/:id" element={<DeckDetailPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/quiz" element={<QuizConfigPage />} />
            <Route path="/quiz/play" element={<QuizPlayPage />} />
            <Route path="/micro" element={<MicroPage />} />
            <Route path="/kana" element={<KanaPage />} />
            <Route path="/talk" element={<TalkPage />} />
            <Route path="/grammar" element={<GrammarPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
      {!fullscreen && <BottomNav />}
    </div>
  )
}
