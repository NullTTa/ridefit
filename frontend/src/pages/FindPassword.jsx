import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

// 이메일+닉네임(회원가입 때 등록한 닉네임)으로 본인 확인 후, 비밀번호는 알려주지 않고 바로 새 비밀번호 설정 화면으로 넘긴다.
function FindPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { resetToken } = await api.post('/api/auth/find-password/verify', { email, name }, { auth: false })
      navigate('/reset-password', { replace: true, state: { resetToken } })
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
          <h1 className="text-2xl font-bold text-ridefit-text">비밀번호 찾기</h1>
          <p className="mt-1 text-sm text-ridefit-text-secondary">
            가입 시 등록한 이메일과 닉네임을 입력하면 새 비밀번호를 설정할 수 있어요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            이메일
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            닉네임
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? '확인 중...' : '본인 확인'}
          </button>

          {error && <p className="text-sm text-ridefit-danger">{error}</p>}
        </form>

        <p className="text-sm text-ridefit-text-secondary">
          <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}

export default FindPassword
