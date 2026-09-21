import { useEffect, useState } from 'react'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../../constants/images'
import { api } from '../../lib/api'

const inputClass =
  'w-full rounded border border-ridefit-border bg-ridefit-bg px-2 py-1.5 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function AdminVehicleModels() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api
      .get(`/api/admin/vehicle-models?page=${page}&size=20`)
      .then((res) => {
        setData(res)
        setDrafts(Object.fromEntries(res.content.map((m) => [m.id, m.imageUrl ?? ''])))
      })
      .catch((err) => setError(err.message))
  }

  useEffect(load, [page])

  const handleSave = async (modelId) => {
    setSavingId(modelId)
    setError(null)
    try {
      const updated = await api.patch(`/api/admin/vehicle-models/${modelId}/image`, {
        imageUrl: drafts[modelId] || null,
      })
      setData((d) => ({ ...d, content: d.content.map((m) => (m.id === modelId ? updated : m)) }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ridefit-text-secondary">
        차종별 대표 이미지를 등록해두면, 사용자가 차량을 등록할 때 사진을 직접 올리지 않아도 내 차고 카드/부품
        입혀보기 화면에 자동으로 적용됩니다. 비워두면 임시 아이콘이 대신 표시됩니다.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">미리보기</th>
              <th className="px-3 py-2">차종</th>
              <th className="px-3 py-2">이미지 URL / 경로</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.content.map((model) => (
              <tr key={model.id} className="border-t border-ridefit-border">
                <td className="px-3 py-2">
                  <img
                    src={model.imageUrl || VEHICLE_PLACEHOLDER_IMAGE}
                    alt={model.name}
                    className="h-10 w-14 rounded bg-ridefit-bg object-contain"
                  />
                </td>
                <td className="px-3 py-2 text-ridefit-text">
                  {model.manufacturerName} {model.name}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="/assets/vehicles/xxx.png 또는 https://..."
                    value={drafts[model.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [model.id]: e.target.value }))}
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleSave(model.id)}
                    disabled={savingId === model.id}
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

export default AdminVehicleModels
