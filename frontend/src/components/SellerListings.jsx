import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// 하나의 부품에 사용자가 등록해둔 판매처 링크들끼리 가격을 비교한다.
// 쿠팡/네이버쇼핑 등을 실시간으로 자동 검색하는 기능이 아니라, "등록된 판매처 중 최저가"임을 분명히 표기한다.
function SellerListings({ partId }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [url, setUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [draft, setDraft] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .get(`/api/parts/${partId}/listings`, { auth: false })
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [partId])

  const handleCrawl = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!url.trim()) return
    setCrawling(true)
    setError(null)
    try {
      const result = await api.post('/api/parts/import', { url })
      setDraft({
        sellerName: result.title || url,
        price: result.price ?? '',
        thumbnailUrl: result.imageUrl || '',
        sourceUrl: url,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setCrawling(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setAdding(true)
    setError(null)
    try {
      await api.post(`/api/parts/${partId}/listings`, {
        sellerName: draft.sellerName,
        price: Number(draft.price),
        thumbnailUrl: draft.thumbnailUrl || null,
        sourceUrl: draft.sourceUrl,
      })
      setDraft(null)
      setUrl('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="mt-3 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 font-semibold text-ridefit-text-secondary">등록된 판매처 중 최저가</p>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && listings.length === 0 && <p className="text-ridefit-text-secondary">등록된 판매처가 없어요.</p>}

      {!loading && listings.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {listings.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <a
                href={l.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-ridefit-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {l.sellerName}
              </a>
              <span className="flex items-center gap-1 whitespace-nowrap">
                {l.lowestPrice && <span className="rounded-full bg-ridefit-primary px-1.5 py-0.5 text-white">최저가</span>}
                {l.price.toLocaleString()}원
              </span>
            </li>
          ))}
        </ul>
      )}

      {!draft ? (
        <form onSubmit={handleCrawl} className="flex gap-1">
          <input
            type="url"
            placeholder="판매처 링크 추가"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded border border-ridefit-border bg-ridefit-card px-2 py-1 text-ridefit-text"
          />
          <button
            type="submit"
            disabled={crawling}
            className="rounded bg-ridefit-primary px-2 py-1 font-semibold text-white disabled:opacity-50"
          >
            {crawling ? '...' : '가져오기'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-1">
          <input
            value={draft.sellerName}
            onChange={(e) => setDraft((d) => ({ ...d, sellerName: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-ridefit-border bg-ridefit-card px-2 py-1 text-ridefit-text"
            placeholder="판매처 이름"
          />
          <input
            type="number"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-ridefit-border bg-ridefit-card px-2 py-1 text-ridefit-text"
            placeholder="가격"
            required
          />
          <div className="flex gap-1">
            <button
              type="submit"
              disabled={adding}
              className="flex-1 rounded bg-ridefit-primary px-2 py-1 font-semibold text-white disabled:opacity-50"
            >
              추가
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDraft(null)
              }}
              className="rounded border border-ridefit-border px-2 py-1 text-ridefit-text-secondary"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default SellerListings
