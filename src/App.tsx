import { Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import DashboardPage from './features/dashboard/DashboardPage'
import DeckListPage from './features/decks/DeckListPage'
import DeckDetailPage from './features/decks/DeckDetailPage'
import ReviewPage from './features/review/ReviewPage'
import QuizConfigPage from './features/quiz/QuizConfigPage'
import QuizPlayPage from './features/quiz/QuizPlayPage'
import MicroPage from './features/micro/MicroPage'
import StatsPage from './features/stats/StatsPage'
import SettingsPage from './features/settings/SettingsPage'

export default function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/decks" element={<DeckListPage />} />
          <Route path="/decks/:id" element={<DeckDetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/quiz" element={<QuizConfigPage />} />
          <Route path="/quiz/play" element={<QuizPlayPage />} />
          <Route path="/micro" element={<MicroPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
