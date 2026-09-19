import { useEffect, useState } from 'react'
import VehicleCascadeSelect from '../../components/VehicleCascadeSelect'
import { api } from '../../lib/api'

const STATUS_OPTIONS = ['호환가능', '브라켓필요', '호환불가']

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-2 py-1.5 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

function AdminCompatibilities() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [parts, setParts] = useState([])
  const [error, setError] = useState(null)

  const [partId, setPartId] = useState('')
  const [modelYearId, setModelYearId] = useState(null)
  const [status, setStatus] = useState(STATUS_OPTIONS[0])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    api.get(`/api/admin/compatibilities?page=${page}&size=20`).then(setData).catch((err) => setError(err.message))
  }

  useEffect(load, [page])
  useEffect(() => {
    api.get('/api/parts', { auth: false }).then(setParts).catch(() => setParts([]))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!partId || !modelYearId) {
      setError('부품과 연식을 모두 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/api/admin/compatibilities', { partId: Number(partId), modelYearId, status, note: note || null })
      setNote('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 호환성 데이터를 삭제할까요?')) return
    try {
      await api.del(`/api/admin/compatibilities/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.put(`/api/admin/compatibilities/${row.id}`, {
        partId: row.part.id,
        modelYearId: row.modelYearId,
        status: newStatus,
        note: row.note,
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-4">
        <p className="text-sm font-semibold text-ridefit-text">새 호환성 데이터 추가</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={partId} onChange={(e) => setPartId(e.target.value)} className={inputClass}>
            <option value="">부품 선택</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <VehicleCascadeSelect onModelYearChange={setModelYearId} />
        <input
          type="text"
          placeholder="비고 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">부품</th>
              <th className="px-3 py-2">차종/연식</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">비고</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.content.map((row) => (
              <tr key={row.id} className="border-t border-ridefit-border">
                <td className="px-3 py-2 text-ridefit-text">{row.part.name}</td>
                <td className="px-3 py-2 text-ridefit-text-secondary">{row.modelYearLabel}</td>
                <td className="px-3 py-2">
                  <select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row, e.target.value)}
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-ridefit-text-secondary">{row.note}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    삭제
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

export default AdminCompatibilities
