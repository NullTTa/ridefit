import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

function AdminMembers() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/api/admin/members?page=${page}&size=20`).then(setData).catch((err) => setError(err.message))
  }, [page])

  if (error) return <p className="text-red-600">에러: {error}</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">닉네임</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">권한</th>
            </tr>
          </thead>
          <tbody>
            {data?.content.map((m) => (
              <tr key={m.id} className="border-t border-ridefit-border">
                <td className="px-3 py-2 text-ridefit-text-secondary">{m.id}</td>
                <td className="px-3 py-2 text-ridefit-text">{m.name}</td>
                <td className="px-3 py-2 text-ridefit-text-secondary">{m.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      m.role === 'ADMIN' ? 'bg-ridefit-primary/20 text-ridefit-primary' : 'bg-ridefit-border text-ridefit-text-secondary'
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ridefit-text-secondary">
        ADMIN 권한은 이 화면에서 바꿀 수 없어요. DB에서 role 컬럼을 직접 수정해주세요.
      </p>

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

export default AdminMembers
