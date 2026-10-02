import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { FOREIGN_TEXT_WARNING, hasForeignText } from '../lib/foreignText'
import SafeImage from './SafeImage'

const inputClass =
  'rounded border border-ridefit-border bg-ridefit-card px-2 py-1 text-ridefit-text focus:border-ridefit-primary focus:outline-none'

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : null
}

// 실제로 열 수 있는 상품 주소(http/https)만 링크로 쓴다. 저장된 주소가 없거나 형식이 다르면 null -
// 그 판매처는 "상품 보기" 링크 대신 "판매처 정보 준비 중"으로 표시한다(주소를 추측해 만들지 않는다).
function productLink(sourceUrl) {
  try {
    const u = new URL(sourceUrl)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

// 판매처 가격비교. 쿠팡/네이버쇼핑 등을 실시간으로 자동 검색하는 기능이 아니라, 등록된 판매처끼리 비교한다.
//  - 가격이 확인되지 않은 판매처는 "가격 확인 필요"로 표시(0원 표시 금지).
//  - "최저가" 배지는 서버가 "가격 확인된 실제 판매처 2곳 이상"일 때만 붙인다(하드코딩 없음).
//  - 예약 도메인(.test)의 예시 판매처는 링크 없이 "예시 데이터"로 구분한다.
function SellerListings({ partId }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [url, setUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlNotice, setCrawlNotice] = useState(null)
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
    setCrawlNotice(null)
    try {
      const result = await api.post('/api/parts/import', { url })
      if (!result.success) setCrawlNotice(result.failReason)
      setDraft({
        sellerName: result.sellerName ?? '',
        productName: result.title ?? '',
        price: result.price ?? '',
        thumbnailUrl: result.imageUrl ?? '',
        externalProductId: result.externalProductId ?? '',
        sourceUrl: result.finalUrl || url,
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
        productName: draft.productName || null,
        price: draft.price === '' ? null : Number(draft.price),
        thumbnailUrl: draft.thumbnailUrl || null,
        externalProductId: draft.externalProductId || null,
        sourceUrl: draft.sourceUrl,
      })
      setDraft(null)
      setUrl('')
      setCrawlNotice(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const realListings = listings.filter((l) => !l.sample)
  const pricedCount = realListings.filter((l) => l.price != null).length

  return (
    <div className="text-sm" onClick={(e) => e.stopPropagation()}>
      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="mb-2 text-ridefit-danger">{error}</p>}

      {!loading && listings.length === 0 && (
        <p className="text-ridefit-text-secondary">아직 등록된 판매처가 없어요.</p>
      )}

      {!loading && pricedCount >= 2 && (
        <p className="mb-3 text-xs text-ridefit-text-secondary">
          가격이 확인된 판매처 {pricedCount}곳 기준으로 비교했어요. 실시간 조회가 아니라 각 판매처의 가격 확인일 기준이에요.
        </p>
      )}

      {!loading && listings.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2" data-testid="seller-listings">
          {listings.map((l) => {
            const link = l.sample ? null : productLink(l.sourceUrl)
            return (
            <li
              key={l.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                l.lowestPrice ? 'border-ridefit-primary bg-ridefit-primary/5' : 'border-ridefit-border bg-ridefit-bg'
              }`}
            >
              <SafeImage
                src={l.thumbnailUrl || l.originalImageUrl}
                alt={l.productName || l.sellerName}
                className="h-14 w-14 shrink-0 rounded-md border border-ridefit-border bg-white object-contain p-0.5"
                fallbackClassName="h-14 w-14 shrink-0 rounded-md border border-ridefit-border text-[10px] leading-tight"
                fallbackText="이미지 없음"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ridefit-text">
                  {l.sellerName}
                  {l.lowestPrice && (
                    <span className="rounded-full bg-ridefit-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">확인 가격 중 최저</span>
                  )}
                  {l.sample && (
                    <span className="rounded-full border border-ridefit-border px-1.5 py-0.5 text-[10px] font-normal text-ridefit-text-secondary">
                      예시 데이터
                    </span>
                  )}
                </p>
                {/* 표시명(displayName)이 있으면 그것을, 없으면 판매처 원본 상품명을 보여준다(원본은 DB에 보존). */}
                {(l.displayName || l.productName) && (
                  <p className="truncate text-xs text-ridefit-text-secondary">{l.displayName || l.productName}</p>
                )}
                {/* 어느 쇼핑몰 주소인지 바로 보이게 도메인을 같이 표시한다. */}
                {link && <p className="truncate text-[11px] text-ridefit-text-secondary/80">{link.hostname.replace(/^www\./, '')}</p>}
                {formatDate(l.checkedAt) && (
                  <p className="text-[11px] text-ridefit-text-secondary/80">확인일 {formatDate(l.checkedAt)}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {l.price != null ? (
                  <span className="font-bold text-ridefit-text">{l.price.toLocaleString()}원</span>
                ) : (
                  <span className="text-xs text-ridefit-text-secondary">가격 확인 필요</span>
                )}
                {l.sample ? (
                  <span className="text-[11px] text-ridefit-text-secondary">실제 판매처 아님</span>
                ) : !link ? (
                  <span className="text-[11px] text-ridefit-text-secondary">판매처 정보 준비 중</span>
                ) : (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-medium text-ridefit-primary hover:underline"
                  >
                    상품 보기 →
                  </a>
                )}
              </div>
            </li>
            )
          })}
        </ul>
      )}

      {!draft ? (
        <form onSubmit={handleCrawl} className="flex gap-1 text-xs">
          <input
            type="url"
            placeholder="판매처 상품 링크 추가 (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            disabled={crawling}
            className="rounded bg-ridefit-primary px-2 py-1 font-semibold text-white disabled:opacity-50"
          >
            {crawling ? '가져오는 중...' : '정보 가져오기'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-1.5 rounded-lg border border-ridefit-border p-3 text-xs">
          {crawlNotice && <p className="text-ridefit-warning">{crawlNotice}</p>}
          <div className="flex gap-3">
            <SafeImage
              src={draft.thumbnailUrl}
              alt="상품 이미지 미리보기"
              className="h-16 w-16 shrink-0 rounded border border-ridefit-border bg-white object-contain"
              fallbackClassName="h-16 w-16 shrink-0 rounded border border-ridefit-border text-[10px]"
              fallbackText="이미지 없음"
            />
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                value={draft.sellerName}
                onChange={(e) => setDraft((d) => ({ ...d, sellerName: e.target.value }))}
                className={inputClass}
                placeholder="판매처 이름 (예: 쿠팡)"
                required
              />
              <input
                value={draft.productName}
                onChange={(e) => setDraft((d) => ({ ...d, productName: e.target.value }))}
                className={inputClass}
                placeholder="판매처 상품명"
              />
              {hasForeignText(draft.productName) && (
                <p className="text-[11px] text-ridefit-warning" data-testid="foreign-text-warning">{FOREIGN_TEXT_WARNING}</p>
              )}
            </div>
          </div>
          <input
            type="number"
            min="1"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            className={inputClass}
            placeholder="가격(원) - 확인한 가격만 입력, 모르면 비워두세요"
          />
          <input
            type="url"
            value={draft.thumbnailUrl}
            onChange={(e) => setDraft((d) => ({ ...d, thumbnailUrl: e.target.value }))}
            className={inputClass}
            placeholder="상품 이미지 URL (선택)"
          />
          <div className="flex gap-1">
            <button
              type="submit"
              disabled={adding}
              className="flex-1 rounded bg-ridefit-primary px-2 py-1 font-semibold text-white disabled:opacity-50"
            >
              {adding ? '추가 중...' : '판매처 추가'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null)
                setCrawlNotice(null)
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
