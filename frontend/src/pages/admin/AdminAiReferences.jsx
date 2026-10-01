import { useEffect, useState } from 'react'
import SafeImage from '../../components/SafeImage'
import { api } from '../../lib/api'

// 부품별 "AI 장착용 참조 이미지" 관리. 대표 이미지(상품 상세/가격비교용)와 분리돼 있다.
// 대표 이미지가 부품만 깨끗하게 찍힌 서버 내 이미지일 때만 "대표 이미지 사용"을 누르고,
// 포장 박스/여러 제품 사진이면 부품만 보이는 이미지를 따로 올린다.
function AdminAiReferences() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [supported, setSupported] = useState([])
  const [onlySupported, setOnlySupported] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api
      .get(`/api/admin/parts?page=${page}&size=100&sort=id`)
      .then(setData)
      .catch((err) => setError(err.message))
  }

  useEffect(load, [page])
  useEffect(() => {
    api.get('/api/ai-fit/supported-categories').then(setSupported).catch(() => setSupported([]))
  }, [])

  const save = async (partId, aiReferenceImageUrl) => {
    setBusyId(partId)
    setError(null)
    try {
      const updated = await api.patch(`/api/admin/parts/${partId}/ai-reference`, { aiReferenceImageUrl })
      setData((d) => ({ ...d, content: d.content.map((p) => (p.id === partId ? updated : p)) }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const upload = async (partId, file) => {
    if (!file) return
    setBusyId(partId)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/api/admin/uploads/part-image', formData)
      await save(partId, res.url)
    } catch (err) {
      setError(err.message)
      setBusyId(null)
    }
  }

  const isInternal = (url) => url && (url.startsWith('/uploads/') || url.startsWith('/assets/'))
  const rows = (data?.content ?? []).filter((p) => !onlySupported || supported.includes(p.category))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ridefit-text-secondary">
        FitRoom의 "AI로 장착해보기"는 여기서 참조 이미지를 등록한 부품만 사용할 수 있어요. 지원 카테고리:{' '}
        {supported.join(', ') || '불러오는 중'}
      </p>
      <label className="flex items-center gap-2 text-sm text-ridefit-text-secondary">
        <input type="checkbox" checked={onlySupported} onChange={(e) => setOnlySupported(e.target.checked)} />
        AI 지원 카테고리만 보기
      </label>

      {error && <p className="text-sm text-ridefit-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">대표 이미지</th>
              <th className="px-3 py-2">부품</th>
              <th className="px-3 py-2">AI 참조 이미지</th>
              <th className="px-3 py-2">변경</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((part) => (
              <tr key={part.id} className="border-t border-ridefit-border align-middle">
                <td className="px-3 py-2">
                  <SafeImage
                    src={part.imageUrl}
                    alt={part.name}
                    className="h-14 w-14 rounded bg-white object-contain"
                    fallbackClassName="h-14 w-14 rounded text-[10px]"
                    fallbackText="없음"
                  />
                </td>
                <td className="px-3 py-2 text-ridefit-text">
                  <span className="text-xs text-ridefit-text-secondary">#{part.id} · {part.category}</span>
                  <p>{part.name}</p>
                </td>
                <td className="px-3 py-2">
                  {part.aiReferenceImageUrl ? (
                    <SafeImage
                      src={part.aiReferenceImageUrl}
                      alt={`${part.name} AI 참조`}
                      className="h-14 w-14 rounded bg-white object-contain"
                      fallbackClassName="h-14 w-14 rounded text-[10px]"
                      fallbackText="읽기 실패"
                    />
                  ) : (
                    <span className="text-xs text-ridefit-warning">AI 장착용 이미지 준비 필요</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1 text-xs">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busyId === part.id}
                      onChange={(e) => upload(part.id, e.target.files?.[0])}
                      className="text-ridefit-text-secondary"
                    />
                    <div className="flex gap-2">
                      {isInternal(part.imageUrl) && part.imageUrl !== part.aiReferenceImageUrl && (
                        <button
                          type="button"
                          disabled={busyId === part.id}
                          onClick={() => save(part.id, part.imageUrl)}
                          className="text-ridefit-primary underline disabled:opacity-50"
                        >
                          대표 이미지 사용
                        </button>
                      )}
                      {part.aiReferenceImageUrl && (
                        <button
                          type="button"
                          disabled={busyId === part.id}
                          onClick={() => save(part.id, null)}
                          className="text-ridefit-danger underline disabled:opacity-50"
                        >
                          해제
                        </button>
                      )}
                    </div>
                  </div>
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

export default AdminAiReferences
