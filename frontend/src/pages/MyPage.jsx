import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function MyPage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const [recentChecks, setRecentChecks] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(true)

  const [interests, setInterests] = useState([])
  const [reservations, setReservations] = useState([])

  const [name, setName] = useState(user?.name ?? '')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [nicknameMessage, setNicknameMessage] = useState(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/me/recent-checks').then(setRecentChecks).catch((err) => setError(err.message)).finally(() => setRecentLoading(false))
    api.get('/api/me/favorites').then(setFavorites).catch((err) => setError(err.message)).finally(() => setFavoritesLoading(false))
    api.get('/api/me/vehicle-interests').then(setInterests).catch(() => setInterests([]))
    api.get('/api/me/reservations').then(setReservations).catch(() => setReservations([]))
  }, [])

  const handleNicknameSubmit = async (e) => {
    e.preventDefault()
    setNicknameSaving(true)
    setNicknameMessage(null)
    try {
      await api.patch('/api/me', { name })
      updateUser({ name })
      setNicknameMessage('닉네임이 변경되었어요.')
    } catch (err) {
      setNicknameMessage(err.message)
    } finally {
      setNicknameSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordMessage(null)
    setPasswordError(null)
    try {
      await api.patch('/api/me/password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordMessage('비밀번호가 변경되었어요.')
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleRemoveFavorite = async (partId) => {
    try {
      await api.del(`/api/me/favorites/${partId}`)
      setFavorites((prev) => prev.filter((f) => f.partId !== partId))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleWithdraw = async () => {
    if (!window.confirm('정말 탈퇴하시겠어요? 등록한 차량과 즐겨찾기는 모두 삭제되고 되돌릴 수 없어요.')) return
    setWithdrawing(true)
    try {
      await api.del('/api/me')
      logout()
      navigate('/')
    } catch (err) {
      setError(err.message)
      setWithdrawing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-ridefit-text">마이페이지</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">{user?.email}</p>

      {error && <p className="mb-4 text-sm text-ridefit-danger">{error}</p>}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ridefit-text">계정 설정</h2>
        <div className="flex flex-col gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-5">
          <form onSubmit={handleNicknameSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
              닉네임
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
            <button
              type="submit"
              disabled={nicknameSaving}
              className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              닉네임 변경
            </button>
          </form>
          {nicknameMessage && <p className="text-xs text-ridefit-text-secondary">{nicknameMessage}</p>}

          <hr className="border-ridefit-border" />

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
                현재 비밀번호
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
                새 비밀번호 (8자 이상)
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="self-start rounded-lg border border-ridefit-primary px-4 py-2 text-sm font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10 disabled:opacity-50"
            >
              비밀번호 변경
            </button>
            {passwordMessage && <p className="text-xs text-ridefit-success">{passwordMessage}</p>}
            {passwordError && <p className="text-xs text-ridefit-danger">{passwordError}</p>}
          </form>

          <hr className="border-ridefit-border" />

          <div>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="text-sm text-ridefit-danger hover:underline disabled:opacity-50"
            >
              {withdrawing ? '탈퇴 처리 중...' : '회원 탈퇴'}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ridefit-text">관심 차량</h2>
        {interests.length === 0 ? (
          <p className="text-sm text-ridefit-text-secondary">
            아직 관심 차량이 없어요.{' '}
            <Link to="/finder" className="text-ridefit-primary hover:underline">
              성향 테스트
            </Link>
            나{' '}
            <Link to="/vehicles" className="text-ridefit-primary hover:underline">
              차량 둘러보기
            </Link>
            에서 등록해보세요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {interests.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/vehicles/${v.id}`}
                  className="block rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-2 text-sm text-ridefit-text transition hover:border-ridefit-primary"
                >
                  {v.manufacturerName} {v.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ridefit-text">내 가상 예약</h2>
          <Link to="/reservations" className="text-sm text-ridefit-primary hover:underline">
            전체 보기
          </Link>
        </div>
        {reservations.length === 0 ? (
          <p className="text-sm text-ridefit-text-secondary">
            아직 예약 기록이 없어요.{' '}
            <Link to="/services" className="text-ridefit-primary hover:underline">
              정비 · 세차 서비스
            </Link>
            에서 예약 과정을 체험해보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reservations.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3 text-sm">
                <span className="font-medium text-ridefit-text">{r.shopName}</span>
                <span className="text-ridefit-text-secondary">
                  {' '}
                  · {r.serviceName} · {r.preferredAt?.slice(0, 16).replace('T', ' ')}
                  {r.status === 'CANCELED' && ' · 취소됨'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-ridefit-text">즐겨찾기한 부품</h2>
        {favoritesLoading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
        {!favoritesLoading && favorites.length === 0 && (
          <p className="text-ridefit-text-secondary">즐겨찾기한 부품이 없어요.</p>
        )}
        {!favoritesLoading && favorites.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {favorites.map((f) => (
              <li
                key={f.partId}
                className="flex items-center justify-between rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ridefit-text">{f.name}</p>
                  <p className="text-xs text-ridefit-text-secondary">
                    {f.category} · {f.price.toLocaleString()}원
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFavorite(f.partId)}
                  className="text-xs text-ridefit-text-secondary hover:text-ridefit-danger"
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ridefit-text">최근 확인한 부품</h2>
        {recentLoading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
        {!recentLoading && recentChecks.length === 0 && (
          <p className="text-ridefit-text-secondary">아직 확인한 부품이 없어요.</p>
        )}
        {!recentLoading && recentChecks.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recentChecks.map((check) => (
              <li
                key={check.id}
                className="flex items-center justify-between rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ridefit-text">{check.partName}</p>
                  <p className="text-xs text-ridefit-text-secondary">{check.vehicleLabel}</p>
                </div>
                <span className="text-xs font-semibold text-ridefit-text-secondary">{check.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default MyPage
