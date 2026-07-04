import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/decks', label: '단어장', icon: '📚' },
  { to: '/quiz', label: '퀴즈', icon: '✏️' },
  { to: '/stats', label: '통계', icon: '📊' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] transition-colors ${
                isActive ? 'font-bold text-rose-600' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
