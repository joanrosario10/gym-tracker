import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, UtensilsCrossed, Droplets, User, type LucideIcon } from 'lucide-react'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
}

const ITEMS: NavItem[] = [
  { to: '/',          icon: Home,            label: 'Home',  end: true },
  { to: '/workouts',  icon: Dumbbell,        label: 'Train' },
  { to: '/diet',      icon: UtensilsCrossed, label: 'Diet' },
  { to: '/hydration', icon: Droplets,        label: 'Water' },
  { to: '/profile',   icon: User,            label: 'Me' },
]

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/85 backdrop-blur-xl border-t border-gray-800/60 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-center gap-1 px-3 py-2">
        {ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 px-3 flex-[1.4]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 px-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="w-[20px] h-[20px] flex-shrink-0"
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                <span
                  className={`text-[12.5px] font-medium tracking-tight overflow-hidden whitespace-nowrap transition-all duration-200 ${
                    isActive ? 'max-w-[60px] opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
