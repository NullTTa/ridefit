import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'ridefit-theme'

function getStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getStoredTheme() ?? getSystemTheme())

  // 사용자가 수동으로 선택한 적이 없으면, OS 다크모드 설정이 바뀔 때 그대로 따라간다.
  useEffect(() => {
    if (getStoredTheme()) return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => setTheme(e.matches ? 'dark' : 'light')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      // 수동으로 고른 테마는 항상 저장해서, 다음부터는 시스템 설정보다 우선한다.
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // 저장에 실패해도 화면 전환 자체는 계속 동작해야 한다.
      }
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme은 ThemeProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}
