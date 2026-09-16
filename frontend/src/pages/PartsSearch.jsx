import { useEffect, useState } from 'react'

const CATEGORIES = ['머플러', '캐리어']

function PartsSearch() {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState(null)

  // 카테고리 선택에 따라 /api/parts 또는 /api/parts?category=... 를 호출한다. (기존 App.jsx 로직 그대로 이전)
  useEffect(() => {
    setLoading(true)
    const url = category
      ? `http://localhost:8080/api/parts?category=${encodeURIComponent(category)}`
      : 'http://localhost:8080/api/parts'

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`서버 응답 오류: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => setParts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-ridefit-text-light dark:text-ridefit-text-dark">
        부품 검색
      </h1>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            category === null
              ? 'bg-ridefit-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          전체
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              category === cat
                ? 'bg-ridefit-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 dark:text-gray-400">불러오는 중...</p>}
      {error && <p className="text-red-600 dark:text-red-400">에러: {error}</p>}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {parts.map((part) => (
            <div
              key={part.id}
              className="rounded-xl bg-white p-4 shadow-md transition hover:-translate-y-1 dark:bg-ridefit-bg-dark-alt"
            >
              <p className="text-xs font-medium text-ridefit-primary">{part.category}</p>
              <p className="mt-1 font-semibold text-ridefit-text-light dark:text-ridefit-text-dark">
                {part.name}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {part.price.toLocaleString()}원
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PartsSearch
