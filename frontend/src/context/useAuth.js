import { createContext, useContext } from 'react'

// 로그인 상태 컨텍스트와 훅. Provider(AuthContext.jsx)와 분리해 두어야 Fast Refresh가 컴포넌트 파일을 그대로 갱신한다.
export const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}
