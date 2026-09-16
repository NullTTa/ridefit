import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const NAV_ITEMS = [
  { to: '/', label: '홈' },
  { to: '/my-vehicle/new', label: '내 차량 등록' },
  { to: '/parts', label: '부품 검색' },
]

function navLinkClass({ isActive }) {
  return `text-sm font-medium transition-colors ${
    isActive
      ? 'text-ridefit-primary'
      : 'text-gray-600 hover:text-ridefit-primary dark:text-gray-300 dark:hover:text-ridefit-primary'
  }`
}

function Header() {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/50 bg-white/70 backdrop-blur dark:border-gray-800/50 dark:bg-ridefit-bg-dark/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ridefit-primary text-sm font-bold text-white">
            RF
          </span>
          <span className="text-lg font-bold text-ridefit-text-light dark:text-ridefit-text-dark">
            RIDEFIT
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="다크모드 전환"
            className="rounded-full p-2 text-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="메뉴 열기"
            className="rounded-md p-2 text-xl md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-ridefit-bg-dark md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={navLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

export default Header
