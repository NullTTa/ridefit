import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RIDEFIT_LOGO_IMAGE } from '../constants/images'

const NAV_ITEMS = [
  { to: '/', label: '홈' },
  { to: '/vehicles', label: '차량' },
  { to: '/finder', label: '성향 테스트' },
  { to: '/parts', label: '부품 찾아보기' },
  { to: '/guide', label: '정보' },
  { to: '/services', label: '정비·예약' },
  { to: '/community', label: '커뮤니티' },
]

function navLinkClass({ isActive }) {
  return `relative py-1 text-sm font-medium transition-colors after:absolute after:-bottom-[21px] after:left-0 after:h-0.5 after:rounded-full after:transition-all ${
    isActive
      ? 'text-ridefit-primary after:w-full after:bg-ridefit-primary'
      : 'text-ridefit-text-secondary after:w-0 hover:text-ridefit-primary hover:after:w-full hover:after:bg-ridefit-primary/40'
  }`
}

function GarageIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M6 17 L9 10 L13 10 L16 17" />
      <path d="M9 10 L8 7 L11 7" />
      <path d="M13 10 L15.5 6.5 L18 8" />
    </svg>
  )
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
    <header className="sticky top-0 z-50 border-b border-ridefit-border bg-ridefit-bg/80 shadow-[0_1px_0_0_rgba(255,107,53,0.15)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex shrink-0 items-center transition-transform hover:scale-[1.03]">
          <img src={RIDEFIT_LOGO_IMAGE} alt="RIDEFIT" className="h-11 w-auto sm:h-12" />
        </Link>

        <nav className="hidden items-center gap-4 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <NavLink to="/reservations" className={navLinkClass}>
              내 예약
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-ridefit-text-secondary">{user?.name}님</span>
              <Link
                to="/mypage"
                className="text-sm font-medium text-ridefit-text-secondary transition-colors hover:text-ridefit-primary focus-visible:text-ridefit-primary focus-visible:outline-none"
              >
                마이페이지
              </Link>
              <Link
                to="/garage"
                className="flex items-center gap-1.5 rounded-full border border-ridefit-border px-3 py-1.5 text-sm font-medium text-ridefit-text-secondary transition-colors hover:border-ridefit-primary hover:text-ridefit-primary focus-visible:border-ridefit-primary focus-visible:text-ridefit-primary focus-visible:outline-none"
              >
                <GarageIcon className="h-4 w-4" />
                내 차고
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="rounded-lg bg-ridefit-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  관리자
                </Link>
              )}
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
          className="rounded-md p-2 text-xl text-ridefit-text lg:hidden"
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-2 border-t border-ridefit-border bg-ridefit-bg px-4 py-3 lg:hidden">
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
            <NavLink to="/mypage" onClick={() => setMenuOpen(false)} className={navLinkClass}>
              마이페이지
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink
              to="/garage"
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-ridefit-primary text-ridefit-primary'
                    : 'border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary'
                }`
              }
            >
              <GarageIcon className="h-4 w-4" />
              내 차고
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/reservations" onClick={() => setMenuOpen(false)} className={navLinkClass}>
              내 예약
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
