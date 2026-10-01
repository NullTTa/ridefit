import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SafeImage from '../../components/SafeImage'
import { api } from '../../lib/api'
import { FOREIGN_TEXT_WARNING, hasForeignText } from '../../lib/foreignText'

const inputClass =
  'w-full rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'
const labelClass = 'mb-1 block text-xs font-medium text-ridefit-text-secondary'

const EMPTY_FORM = {
  name: '',
  category: '',
  price: '',
  sellerName: '',
  listingPrice: '',
  originalImageUrl: '',
  externalProductId: '',
  compatStatus: '호환가능',
  compatNote: '',
}

function yearLabel(y) {
  if (y.year) return `${y.year}년${y.chassisCode ? ` (${y.chassisCode})` : ''}`
  return y.chassisCode ? y.chassisCode : `연식 미상 #${y.id}`
}

// 관리자 "상품 URL로 부품 등록":
// 상품 URL → [상품 정보 가져오기] → 자동 입력(실패하면 직접 입력) → 호환 차량/카테고리 선택 → AI 참조 이미지(선택) → 저장.
// 가격은 판매처 페이지에 구조화된 값(JSON-LD 등)이 있을 때만 자동으로 채워지고, 나머지는 관리자가 확인한 값만 넣는다.
function AdminProductImport() {
  const [url, setUrl] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(null)

  const [categories, setCategories] = useState([])
  const [manufacturers, setManufacturers] = useState([])
  const [manufacturerId, setManufacturerId] = useState('')
  const [models, setModels] = useState([])
  const [vehicleModelId, setVehicleModelId] = useState('')
  const [years, setYears] = useState([])
  const [selectedYearIds, setSelectedYearIds] = useState(new Set())

  const [aiReferenceUrl, setAiReferenceUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/parts', { auth: false }).then((parts) => {
      setCategories([...new Set(parts.map((p) => p.category))].sort())
    })
    api.get('/api/manufacturers', { auth: false }).then(setManufacturers).catch(() => setManufacturers([]))
  }, [])

  useEffect(() => {
    setModels([])
    setVehicleModelId('')
    if (!manufacturerId) return
    api.get(`/api/manufacturers/${manufacturerId}/vehicle-models`, { auth: false }).then(setModels)
  }, [manufacturerId])

  useEffect(() => {
    setYears([])
    if (!vehicleModelId) return
    api.get(`/api/vehicle-models/${vehicleModelId}/model-years`, { auth: false }).then(setYears)
  }, [vehicleModelId])

  const selectedYears = useMemo(() => [...selectedYearIds], [selectedYearIds])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handlePreview = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setPreviewing(true)
    setError(null)
    setSaved(null)
    try {
      const res = await api.post('/api/admin/products/preview', { url })
      setPreview(res)
      setForm({
        ...EMPTY_FORM,
        name: res.title ?? '',
        category: res.category && categories.includes(res.category) ? res.category : '',
        price: res.price ?? '',
        sellerName: res.sellerName ?? '',
        listingPrice: res.price ?? '',
        originalImageUrl: res.imageUrl ?? '',
        externalProductId: res.externalProductId ?? '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setPreviewing(false)
    }
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/api/admin/uploads/part-image', formData)
      setAiReferenceUrl(res.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const toggleYear = (id) => {
    setSelectedYearIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await api.post('/api/admin/products', {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        sourceUrl: preview?.finalUrl || url || null,
        sellerName: form.sellerName || null,
        listingPrice: form.listingPrice === '' ? null : Number(form.listingPrice),
        originalImageUrl: form.originalImageUrl || null,
        externalProductId: form.externalProductId || null,
        aiReferenceImageUrl: aiReferenceUrl || null,
        modelYearIds: selectedYears,
        compatStatus: form.compatStatus,
        compatNote: form.compatNote || null,
      })
      setSaved(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setUrl('')
    setPreview(null)
    setForm(null)
    setSelectedYearIds(new Set())
    setAiReferenceUrl('')
    setSaved(null)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-ridefit-text-secondary">
        판매처 상품 URL을 넣으면 공개된 상품 정보(JSON-LD → Open Graph → meta 순)를 읽어 자동으로 채워요. 쿠팡·알리익스프레스·네이버
        스마트스토어처럼 공식(제휴) API가 필요한 판매처는 페이지를 요청하지 않고 직접 입력으로 안내해요. 가격은 확인한 값만 넣으세요.
      </p>

      {error && <p className="text-sm text-ridefit-danger">{error}</p>}

      {saved ? (
        <div className="rounded-xl border border-ridefit-success-border bg-ridefit-success-bg p-5 text-sm text-ridefit-success">
          <p className="font-semibold">"{saved.part.name}" 부품을 등록했어요.</p>
          <p className="mt-1">
            {saved.imageMessage} 호환 연식 {saved.compatibilityCount}개 · 판매처 {saved.listingCreated ? '1곳 등록' : '미등록'} · AI
            장착용 이미지 {saved.part.aiReferenceImageUrl ? '있음' : '준비 필요'}
          </p>
          <div className="mt-3 flex gap-3">
            <Link to={`/parts/${saved.part.id}`} className="font-medium underline">
              부품 상세 보기
            </Link>
            <button type="button" onClick={reset} className="font-medium underline">
              다른 상품 등록
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handlePreview} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="상품 URL (https://...)"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={previewing}
              className="shrink-0 rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {previewing ? '가져오는 중...' : '상품 정보 가져오기'}
            </button>
            {!form && (
              <button
                type="button"
                onClick={() => setForm({ ...EMPTY_FORM })}
                className="shrink-0 rounded-lg border border-ridefit-border px-3 py-2 text-sm text-ridefit-text-secondary"
              >
                직접 입력
              </button>
            )}
          </form>

          {preview && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                preview.success
                  ? 'border-ridefit-success-border bg-ridefit-success-bg text-ridefit-success'
                  : 'border-ridefit-warning-border bg-ridefit-warning-bg text-ridefit-warning'
              }`}
              data-testid="preview-result"
            >
              {preview.success
                ? `상품 정보를 가져왔어요 (출처: ${preview.dataSource}). 가격 ${preview.price != null ? '자동 확인됨' : '미확인 - 직접 확인 필요'}.`
                : preview.failReason}
            </p>
          )}

          {form && (
            <form onSubmit={handleSave} className="flex flex-col gap-5 rounded-xl border border-ridefit-border bg-ridefit-card p-5">
              <div className="flex gap-4">
                <div>
                  <p className={labelClass}>대표 이미지 미리보기</p>
                  <SafeImage
                    src={form.originalImageUrl}
                    alt="대표 이미지 미리보기"
                    className="h-32 w-32 rounded-lg border border-ridefit-border bg-white object-contain"
                    fallbackClassName="h-32 w-32 rounded-lg border border-ridefit-border"
                    fallbackText="이미지 없음"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <label>
                    <span className={labelClass}>상품명 *</span>
                    <input value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
                    {hasForeignText(form.name) && (
                      <span className="mt-1 block text-xs text-ridefit-warning" data-testid="foreign-text-warning">{FOREIGN_TEXT_WARNING}</span>
                    )}
                  </label>
                  <label>
                    <span className={labelClass}>대표 이미지 URL (등록 시 서버에 저장 시도)</span>
                    <input
                      value={form.originalImageUrl}
                      onChange={(e) => update('originalImageUrl', e.target.value)}
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>카테고리 *</span>
                  <select value={form.category} onChange={(e) => update('category', e.target.value)} className={inputClass} required>
                    <option value="">선택</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>부품 대표 가격(원) * — 확인한 가격</span>
                  <input
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={(e) => update('price', e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label>
                  <span className={labelClass}>판매처 이름</span>
                  <input value={form.sellerName} onChange={(e) => update('sellerName', e.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>이 판매처 가격(원) — 모르면 비워두기</span>
                  <input
                    type="number"
                    min="1"
                    value={form.listingPrice}
                    onChange={(e) => update('listingPrice', e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>외부 상품 ID (자동 확인된 경우)</span>
                  <input
                    value={form.externalProductId}
                    onChange={(e) => update('externalProductId', e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold text-ridefit-text">호환 차량 (확인된 연식만 선택)</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className={inputClass}>
                    <option value="">제조사 선택</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={vehicleModelId}
                    onChange={(e) => setVehicleModelId(e.target.value)}
                    className={inputClass}
                    disabled={!manufacturerId}
                  >
                    <option value="">모델 선택</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                {years.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {years.map((y) => (
                      <label key={y.id} className="flex items-center gap-1.5 rounded-lg border border-ridefit-border px-2 py-1 text-xs text-ridefit-text">
                        <input type="checkbox" checked={selectedYearIds.has(y.id)} onChange={() => toggleYear(y.id)} />
                        {yearLabel(y)}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ridefit-text-secondary">선택한 연식 {selectedYears.length}개</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={form.compatStatus} onChange={(e) => update('compatStatus', e.target.value)} className={inputClass}>
                    <option value="호환가능">호환가능</option>
                    <option value="브라켓필요">브라켓필요</option>
                  </select>
                  <input
                    value={form.compatNote}
                    onChange={(e) => update('compatNote', e.target.value)}
                    className={inputClass}
                    placeholder="호환 메모 (예: 순정 브라켓 사용)"
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ridefit-text">AI 장착용 참조 이미지 (선택)</legend>
                <p className="mb-2 text-xs text-ridefit-text-secondary">
                  부품 하나만 또렷하게 보이는 사진(가능하면 배경 없는 PNG)을 올려주세요. 포장 박스·여러 제품이 함께 찍힌 대표 이미지는 AI
                  장착 결과가 불안정해서 따로 받습니다. 없으면 "AI 장착용 이미지 준비 필요"로 표시돼요.
                </p>
                <div className="flex items-center gap-3">
                  <SafeImage
                    src={aiReferenceUrl}
                    alt="AI 참조 이미지"
                    className="h-20 w-20 rounded-lg border border-ridefit-border bg-white object-contain"
                    fallbackClassName="h-20 w-20 rounded-lg border border-ridefit-border text-[10px]"
                    fallbackText="준비 필요"
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                    disabled={uploading}
                    className="text-xs text-ridefit-text-secondary"
                  />
                  {aiReferenceUrl && (
                    <button type="button" onClick={() => setAiReferenceUrl('')} className="text-xs text-ridefit-danger underline">
                      지우기
                    </button>
                  )}
                </div>
              </fieldset>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '부품 등록'}
                </button>
                <button type="button" onClick={reset} className="rounded-lg border border-ridefit-border px-4 py-2 text-sm text-ridefit-text-secondary">
                  취소
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}

export default AdminProductImport
