import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 백엔드(/api/parts)에서 부품 목록을 가져와 화면에 렌더링한다.
  useEffect(() => {
    fetch('http://localhost:8080/api/parts')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`서버 응답 오류: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => setParts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="center">
      <h1>부품 목록</h1>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>에러: {error}</p>}

      {!loading && !error && (
        <ul>
          {parts.map((part) => (
            <li key={part.id}>
              {part.name} - {part.price.toLocaleString()}원
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default App
