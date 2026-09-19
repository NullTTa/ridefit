import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from '../lib/api'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  const [sessionExpired, setSessionExpired] = useState(false)

  const persist = (tokenResponse) => {
    const { token, ...userInfo } = tokenResponse
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
    } catch {
      // 저장 공간이 없어도(시크릿 모드 등) 로그인 자체는 세션 동안 동작해야 한다.
    }
    setUser(userInfo)
  }

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {
      // ignore
    }
    setUser(null)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password }, { auth: false })
    persist(data)
    return data
  }, [])

  const signup = useCallback(async (email, password, name) => {
    const data = await api.post('/api/auth/signup', { email, password, name }, { auth: false })
    persist(data)
    return data
  }, [])

  // JWT가 만료/무효화되어 401이 오면 자동으로 로그아웃시키고, 로그인 화면에서 안내 문구를 띄운다.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      setSessionExpired(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    login,
    signup,
    logout,
    sessionExpired,
    clearSessionExpired: () => setSessionExpired(false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}
