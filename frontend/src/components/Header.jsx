import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: '홈' },
  { to: '/parts', label: '부품 찾아보기' },
  { to: '/community', label: '커뮤니티' },
]

function navLinkClass({ isActive }) {
  return `text-sm font-medium transition-colors ${
    isActive ? 'text-ridefit-primary' : 'text-ridefit-text-secondary hover:text-ridefit-primary'
  }`
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-ridefit-border bg-ridefit-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ridefit-accent text-sm font-bold text-white">
            RF
          </span>
          <span className="text-lg font-bold text-ridefit-text">RIDEFIT</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <NavLink to="/garage" end className={navLinkClass}>
              내 차고
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              관리자
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <Link to="/mypage" className="text-sm text-ridefit-text-secondary hover:text-ridefit-primary">
                {user?.name}님
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-ridefit-border px-3 py-1.5 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-ridefit-text-secondary hover:text-ridefit-primary">
                로그인
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-ridefit-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="메뉴 열기"
          className="rounded-md p-2 text-xl text-ridefit-text md:hidden"
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-ridefit-border bg-ridefit-bg px-4 py-3 md:hidden">
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
          {isAuthenticated && (
            <NavLink to="/garage" end onClick={() => setMenuOpen(false)} className={navLinkClass}>
              내 차고
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/mypage" onClick={() => setMenuOpen(false)} className={navLinkClass}>
              마이페이지
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" onClick={() => setMenuOpen(false)} className={navLinkClass}>
              관리자
            </NavLink>
          )}

          {isAuthenticated ? (
            <button type="button" onClick={handleLogout} className="mt-2 text-left text-sm font-medium text-ridefit-text-secondary">
              로그아웃
            </button>
          ) : (
            <div className="mt-2 flex gap-4">
              <NavLink to="/login" onClick={() => setMenuOpen(false)} className={navLinkClass}>
                로그인
              </NavLink>
              <NavLink to="/signup" onClick={() => setMenuOpen(false)} className={navLinkClass}>
                회원가입
              </NavLink>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}

export default Header
