import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
  const { login, sessionExpired, clearSessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname ?? '/garage'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    clearSessionExpired()

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-bold text-ridefit-text-light dark:text-ridefit-text-dark">로그인</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          내 차고와 호환성 확인 기록을 보려면 로그인하세요.
        </p>
      </div>

      {sessionExpired && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
          세션이 만료되었어요, 다시 로그인해주세요.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-md dark:bg-ridefit-bg-dark-alt"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          이메일
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          비밀번호
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary dark:border-gray-700 dark:bg-ridefit-bg-dark"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        계정이 없으신가요?{' '}
        <Link to="/signup" className="font-medium text-ridefit-primary hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}

export default Login
