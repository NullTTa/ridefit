import { useLocation } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import VehicleHighlightAnimation from '../components/VehicleHighlightAnimation'

function Login() {
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/garage'

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      <div className="hidden bg-ridefit-card md:flex md:w-1/2">
        <VehicleHighlightAnimation />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <LoginForm redirectTo={from} description="내 차고와 호환성 확인 기록을 보려면 로그인하세요." />
      </div>
    </div>
  )
}

export default Login
