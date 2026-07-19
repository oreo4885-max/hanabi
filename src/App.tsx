import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const DeckListPage = lazy(() => import('./features/decks/DeckListPage'))
const DeckDetailPage = lazy(() => import('./features/decks/DeckDetailPage'))
const ReviewPage = lazy(() => import('./features/review/ReviewPage'))
const QuizConfigPage = lazy(() => import('./features/quiz/QuizConfigPage'))
const QuizPlayPage = lazy(() => import('./features/quiz/QuizPlayPage'))
const MicroPage = lazy(() => import('./features/micro/MicroPage'))
const KanaPage = lazy(() => import('./features/kana/KanaPage'))
const TalkPage = lazy(() => import('./features/talk/TalkPage'))
const GrammarPage = lazy(() => import('./features/grammar/GrammarPage'))
const StatsPage = lazy(() => import('./features/stats/StatsPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

export default function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">
        <Suspense
          fallback={<p className="pt-16 text-center text-sm text-slate-400">불러오는 중…</p>}
        >
          <Routes>
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
      <BottomNav />
    </div>
  )
}
