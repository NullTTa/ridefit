import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import VehicleCascadeSelect from '../components/VehicleCascadeSelect'
import { api } from '../lib/api'

const inputClass =
  'rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

const STATUS_BADGE = {
  호환가능: 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success',
  브라켓필요: 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning',
  호환불가: 'border-ridefit-danger-border bg-ridefit-danger-bg text-ridefit-danger',
  정보없음: 'border-ridefit-border bg-ridefit-bg text-ridefit-text-secondary',
}

function PartImport() {
  const [searchParams] = useSearchParams()
  const presetVehicleId = searchParams.get('vehicleId')

  const [url, setUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlAttempted, setCrawlAttempted] = useState(false)
  const [crawlFailed, setCrawlFailed] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({ name: '', price: '', category: '', imageUrl: '' })
  const [matchedModelYearId, setMatchedModelYearId] = useState(null)
  const [matchedVehicleModelId, setMatchedVehicleModelId] = useState(null)
  const [matchedLabel, setMatchedLabel] = useState(null)
  const [manualModelYearId, setManualModelYearId] = useState(null)
  const [needsManualMatch, setNeedsManualMatch] = useState(false)

  const [creating, setCreating] = useState(false)
  const [part, setPart] = useState(null)

  const [vehicles, setVehicles] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState(presetVehicleId ?? '')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  useEffect(() => {
    api.get('/api/my-vehicles').then(setVehicles).catch(() => setVehicles([]))
  }, [])

  const handleCrawl = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setCrawling(true)
    setError(null)
    setCrawlAttempted(true)
    setPart(null)
    setCheckResult(null)

    try {
      const result = await api.post('/api/parts/import', { url })
      if (result.success) {
        setCrawlFailed(false)
        setForm({
          name: result.title ?? '',
          price: result.price ?? '',
          category: result.category ?? '',
          imageUrl: result.imageUrl ?? '',
        })
        if (result.matchedVehicleModelId) {
          setMatchedVehicleModelId(result.matchedVehicleModelId)
          setMatchedModelYearId(result.matchedModelYearId ?? null)
          setMatchedLabel(
            `${result.matchedVehicleModelName}${result.matchedYear ? ` ${result.matchedYear}년` : ' (전 연식)'}`,
          )
          setNeedsManualMatch(false)
        } else {
          setMatchedVehicleModelId(null)
          setMatchedModelYearId(null)
          setMatchedLabel(null)
          setNeedsManualMatch(true)
        }
      } else {
        // 크롤링 실패는 정상적인 상황이다 — 에러 화면 대신 수동 입력 폼으로 바로 전환한다.
        setCrawlFailed(true)
        setForm({ name: '', price: '', category: '', imageUrl: '' })
        setNeedsManualMatch(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCrawling(false)
    }
  }

  const handleCreatePart = async (e) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    try {
      const created = await api.post('/api/parts', {
        name: form.name,
        price: Number(form.price),
        category: form.category,
        imageUrl: form.imageUrl || null,
        sourceUrl: url || null,
        modelYearId: needsManualMatch ? manualModelYearId : matchedModelYearId,
        vehicleModelId: needsManualMatch ? null : matchedModelYearId ? null : matchedVehicleModelId,
      })
      setPart(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSelectVehicle = async (vehicleId) => {
    setSelectedVehicleId(vehicleId)
    setCheckResult(null)
    if (!vehicleId || !part) return

    setChecking(true)
    try {
      const result = await api.get(`/api/parts/${part.id}/check?myVehicleId=${vehicleId}`)
      setCheckResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  // part가 막 생성된 직후, 이미 선택된 차량이 있으면 곧바로 확인한다.
  useEffect(() => {
    if (part && selectedVehicleId) {
      handleSelectVehicle(selectedVehicleId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part])

  const canConfirmPart = form.name && form.price && form.category && (needsManualMatch ? manualModelYearId : true)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-ridefit-text">부품 링크로 호환성 확인</h1>
      <p className="mb-8 text-sm text-ridefit-text-secondary">
        판매 페이지 링크를 붙여넣으면 제목/가격/카테고리를 자동으로 가져오고, 내 차량과 호환되는지 바로 확인해요.
      </p>

      {!part && (
        <form onSubmit={handleCrawl} className="mb-6 flex gap-2">
          <input
            type="url"
            required
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={crawling}
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {crawling ? '가져오는 중...' : '가져오기'}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-ridefit-danger">{error}</p>}

      {crawlAttempted && !part && (
        <form
          onSubmit={handleCreatePart}
          className="flex flex-col gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg"
        >
          {crawlFailed && (
            <p className="rounded-lg border border-ridefit-warning-border bg-ridefit-warning-bg px-3 py-2 text-sm text-ridefit-warning">
              이 판매처는 자동으로 정보를 가져올 수 없었어요. 아래에 직접 입력해주세요.
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            상품명
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
              가격 (원)
              <input
                type="number"
                required
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
              카테고리
              <input
                type="text"
                required
                placeholder="예: 머플러"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            이미지 URL (선택)
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-2 text-sm font-medium text-ridefit-text-secondary">
            대상 차종
            {!needsManualMatch && matchedLabel && (
              <div className="flex items-center justify-between rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2">
                <span className="text-ridefit-text">자동 인식됨: {matchedLabel}</span>
                <button
                  type="button"
                  onClick={() => setNeedsManualMatch(true)}
                  className="text-xs font-medium text-ridefit-primary hover:underline"
                >
                  직접 선택
                </button>
              </div>
            )}
            {needsManualMatch && <VehicleCascadeSelect onModelYearChange={setManualModelYearId} />}
          </div>

          <button
            type="submit"
            disabled={creating || !canConfirmPart}
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {creating ? '등록 중...' : '이 부품으로 확인하기'}
          </button>
        </form>
      )}

      {part && (
        <div className="flex flex-col gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg">
          <div className="flex gap-4">
            {part.imageUrl && (
              <img src={part.imageUrl} alt={part.name} className="h-20 w-20 rounded-lg object-cover" />
            )}
            <div>
              <p className="text-xs font-medium text-ridefit-primary">{part.category}</p>
              <p className="font-semibold text-ridefit-text">{part.name}</p>
              <p className="text-sm text-ridefit-text-secondary">{part.price.toLocaleString()}원</p>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-ridefit-text-secondary">
            확인할 내 차량
            <select
              value={selectedVehicleId}
              onChange={(e) => handleSelectVehicle(e.target.value)}
              className={inputClass}
            >
              <option value="">차량을 선택하세요</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.modelYearLabel}
                </option>
              ))}
            </select>
          </label>

          {checking && <p className="text-sm text-ridefit-text-secondary">확인 중...</p>}

          {checkResult && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${STATUS_BADGE[checkResult.status] ?? STATUS_BADGE.정보없음}`}>
              {checkResult.proceedAllowed ? (
                <>
                  <p>호환됩니다 ({checkResult.status})</p>
                  {checkResult.note && <p className="mt-1 text-xs opacity-80">{checkResult.note}</p>}
                  <Link
                    to={`/synth?partId=${part.id}&vehicleId=${selectedVehicleId}`}
                    className="mt-3 inline-block rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                  >
                    AI 합성 미리보기로 이동
                  </Link>
                </>
              ) : (
                <p>호환되지 않음</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PartImport
