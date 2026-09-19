import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 로그인이 필요한 화면을 감싸는 가드. 비로그인 상태면 로그인 페이지로 보내고,
// 로그인에 성공하면 원래 가려던 경로(state.from)로 되돌아온다.
function RequireAuth({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

export default RequireAuth
