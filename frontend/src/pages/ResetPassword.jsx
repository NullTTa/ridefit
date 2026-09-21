import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

// /find-password에서 본인 확인을 마쳐야만 얻는 resetToken이 있어야 접근 가능한 화면.
function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetToken = location.state?.resetToken

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  if (!resetToken) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-sm flex-col gap-4 text-center">
          <h1 className="text-2xl font-bold text-ridefit-text">잘못된 접근이에요</h1>
          <p className="text-sm text-ridefit-text-secondary">
            비밀번호 찾기를 먼저 진행해주세요.
          </p>
          <Link
            to="/find-password"
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110"
          >
            비밀번호 찾기로 이동
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-sm flex-col gap-4 text-center">
          <h1 className="text-2xl font-bold text-ridefit-text">비밀번호가 변경됐어요</h1>
          <p className="text-sm text-ridefit-text-secondary">새 비밀번호로 다시 로그인해주세요.</p>
          <Link
            to="/login"
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 서로 일치하지 않아요.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/auth/reset-password', { resetToken, newPassword }, { auth: false })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ridefit-text">새 비밀번호 설정</h1>
          <p className="mt-1 text-sm text-ridefit-text-secondary">기존 비밀번호는 표시되지 않아요. 새 비밀번호를 입력해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            새 비밀번호 (8자 이상)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            새 비밀번호 확인
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? '변경 중...' : '비밀번호 변경'}
          </button>

          {error && <p className="text-sm text-ridefit-danger">{error}</p>}
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
