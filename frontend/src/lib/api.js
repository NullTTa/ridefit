const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const TOKEN_KEY = 'ridefit-token'
export const USER_KEY = 'ridefit-user'

let unauthorizedHandler = null

// 401 응답을 받았을 때(=JWT 만료/무효) 호출할 콜백을 등록해둔다.
// AuthContext가 마운트될 때 로그아웃 처리 + 안내 메시지 표시 로직을 여기에 연결한다.
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const token = auth ? getToken() : null
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  if (res.status === 401 && auth && token && unauthorizedHandler) {
    unauthorizedHandler()
  }

  if (!res.ok) {
    let message = '요청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
    try {
      const data = await res.json()
      if (data && typeof data.message === 'string') {
        message = data.message
      }
    } catch {
      // JSON이 아닌 에러 응답은 기본 문구를 그대로 사용한다.
    }
    const error = new Error(message)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

export { API_BASE }
