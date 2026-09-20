import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/compatibilities', label: '호환성 관리' },
  { to: '/admin/part-conflicts', label: '부품 충돌 관리' },
  { to: '/admin/part-videos', label: '설치 영상 관리' },
  { to: '/admin/vehicle-models', label: '차종 이미지 관리' },
  { to: '/admin/members', label: '회원 관리' },
]

function tabClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-ridefit-primary text-white' : 'text-ridefit-text-secondary hover:bg-ridefit-card'
  }`
}

function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text">관리자</h1>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-ridefit-border pb-4">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}

export default AdminLayout
