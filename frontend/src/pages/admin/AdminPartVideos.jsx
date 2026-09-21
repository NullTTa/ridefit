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
        setDrafts(
          Object.fromEntries(
            res.content.map((p) => [
              p.id,
              {
                installVideoUrl: p.installVideoUrl ?? '',
                imageUrl: p.imageUrl ?? '',
                externalRating: p.externalRating ?? '',
                externalRatingCount: p.externalRatingCount ?? '',
                externalRatingSource: p.externalRatingSource ?? '',
              },
            ]),
          ),
        )
      })
      .catch((err) => setError(err.message))
  }

  useEffect(load, [page])

  const updateDraft = (partId, field, value) => {
    setDrafts((d) => ({ ...d, [partId]: { ...d[partId], [field]: value } }))
  }

  const handleSave = async (partId) => {
    setSavingId(partId)
    setError(null)
    const draft = drafts[partId]
    try {
      await api.patch(`/api/admin/parts/${partId}/video`, { installVideoUrl: draft.installVideoUrl || null })
      await api.patch(`/api/admin/parts/${partId}/image`, { imageUrl: draft.imageUrl || null })
      await api.patch(`/api/admin/parts/${partId}/external-rating`, {
        externalRating: draft.externalRating === '' ? null : Number(draft.externalRating),
        externalRatingCount: draft.externalRatingCount === '' ? null : Number(draft.externalRatingCount),
        externalRatingSource: draft.externalRatingSource || null,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ridefit-text-secondary">
        부품별 대표 이미지 / 설치 방법 영상 / 외부 사이트 평점을 관리합니다. 이미지 URL은 공식 제조사·판매처 등
        출처가 확실한 실제 상품 사진만 등록하세요 (다른 연식/모델 사진을 붙이지 마세요). 외부 평점은 Webike 등에서
        실제로 확인한 값만 입력하고, 확인되지 않으면 비워두세요 — RIDEFIT 자체 평점과 자동으로 합산되지 않습니다.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-ridefit-card text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">미리보기</th>
              <th className="px-3 py-2">부품</th>
              <th className="px-3 py-2">대표 이미지 URL</th>
              <th className="px-3 py-2">설치 영상 링크</th>
              <th className="px-3 py-2">외부 평점</th>
              <th className="px-3 py-2">외부 리뷰수</th>
              <th className="px-3 py-2">출처</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.content.map((part) => {
              const draft = drafts[part.id] ?? {}
              return (
                <tr key={part.id} className="border-t border-ridefit-border align-top">
                  <td className="px-3 py-2">
                    {draft.imageUrl ? (
                      <img src={draft.imageUrl} alt={part.name} className="h-10 w-14 rounded bg-ridefit-bg object-contain" />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded bg-ridefit-bg text-[10px] text-ridefit-text-secondary">
                        없음
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ridefit-text">
                    {part.name}
                    <p className="text-xs text-ridefit-text-secondary">{part.category}</p>
                  </td>
                  <td className="min-w-[180px] px-3 py-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={draft.imageUrl ?? ''}
                      onChange={(e) => updateDraft(part.id, 'imageUrl', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="min-w-[180px] px-3 py-2">
                    <input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={draft.installVideoUrl ?? ''}
                      onChange={(e) => updateDraft(part.id, 'installVideoUrl', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="미입력"
                      value={draft.externalRating ?? ''}
                      onChange={(e) => updateDraft(part.id, 'externalRating', e.target.value)}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="미입력"
                      value={draft.externalRatingCount ?? ''}
                      onChange={(e) => updateDraft(part.id, 'externalRatingCount', e.target.value)}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      placeholder="예: Webike"
                      value={draft.externalRatingSource ?? ''}
                      onChange={(e) => updateDraft(part.id, 'externalRatingSource', e.target.value)}
                      className={`${inputClass} w-24`}
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
              )
            })}
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
