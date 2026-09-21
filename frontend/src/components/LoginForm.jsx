import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Home 히어로와 /login 페이지에서 공통으로 쓰는 로그인 폼.
function LoginForm({ redirectTo = '/garage', title = '로그인', description, as: Heading = 'h1' }) {
  const { login, sessionExpired, clearSessionExpired } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    clearSessionExpired()

    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div>
        <Heading className="text-2xl font-bold text-ridefit-text">{title}</Heading>
        {description && <p className="mt-1 text-sm text-ridefit-text-secondary">{description}</p>}
      </div>

      {sessionExpired && (
        <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          세션이 만료되었어요, 다시 로그인해주세요.
        </p>
      )}

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
          비밀번호
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
          />
        </label>

        <Link to="/find-password" className="-mt-2 self-end text-xs font-medium text-ridefit-primary hover:underline">
          비밀번호를 잊으셨나요?
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <p className="text-sm text-ridefit-text-secondary">
        계정이 없으신가요?{' '}
        <Link to="/signup" className="font-medium text-ridefit-primary hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}

export default LoginForm
