import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import VehicleHighlightAnimation from '../components/VehicleHighlightAnimation'
import { useAuth } from '../context/AuthContext'

function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await signup(email, password, name)
      navigate('/garage', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col md:min-h-[calc(100vh-4rem)] md:flex-row">
      <div className="hidden bg-ridefit-card md:flex md:w-1/2">
        <VehicleHighlightAnimation />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-ridefit-text">회원가입</h1>
            <p className="mt-1 text-sm text-ridefit-text-secondary">가입 후 바로 로그인 상태로 시작합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              비밀번호 (8자 이상)
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? '가입 중...' : '회원가입'}
            </button>

            {error && <p className="text-sm text-ridefit-danger">{error}</p>}
          </form>

          <p className="text-sm text-ridefit-text-secondary">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
