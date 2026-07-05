import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { seedBundledDecks } from './db/seed'
import { startReminderLoop } from './lib/reminder'

seedBundledDecks()
  .then(() => startReminderLoop())
  .catch((err) => console.error('시드 실패:', err))

if ('storage' in navigator && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
