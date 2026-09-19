import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const inputClass =
  'w-full rounded border border-ridefit-border bg-ridefit-bg px-2 py-1.5 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function AdminPartVideos() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api
      .get(`/api/admin/parts?page=${page}&size=20`)
      .then((res) => {
        setData(res)
        setDrafts(Object.fromEntries(res.content.map((p) => [p.id, p.installVideoUrl ?? ''])))
      })
      .catch((err) => setError(err.message))
  }

  useEffect(load, [page])

  const handleSave = async (partId) => {
    setSavingId(partId)
    setError(null)
    try {
      await api.patch(`/api/admin/parts/${partId}/video`, { installVideoUrl: drafts[partId] || null })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ridefit-text-secondary">
        부품(카테고리)별 설치 방법 유튜브 링크를 등록해두면, 부품 찾아보기/게시글 상세에서 임베드로 보여줍니다.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">부품</th>
              <th className="px-3 py-2">카테고리</th>
              <th className="px-3 py-2">설치 방법 영상 링크</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.content.map((part) => (
              <tr key={part.id} className="border-t border-ridefit-border">
                <td className="px-3 py-2 text-ridefit-text">{part.name}</td>
                <td className="px-3 py-2 text-ridefit-text-secondary">{part.category}</td>
                <td className="px-3 py-2">
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={drafts[part.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [part.id]: e.target.value }))}
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleSave(part.id)}
                    disabled={savingId === part.id}
                    className="rounded bg-ridefit-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    저장
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-ridefit-border px-3 py-1.5 text-sm text-ridefit-text-secondary disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-sm text-ridefit-text-secondary">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-ridefit-border px-3 py-1.5 text-sm text-ridefit-text-secondary disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

export default AdminPartVideos
