import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Ico } from '../../components/Icon'
import { api } from '../../lib/api'

const inputClass =
  'w-full rounded-lg border border-ridefit-border bg-ridefit-bg px-2 py-1.5 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const EMPTY = { partId: '', sellerName: '', price: '', sourceUrl: '', checkedAt: today() }
const formatDay = (iso) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '-')

// 관리자 "판매처 가격 관리": 기존 seller_listing(부품 1 - N 판매처)을 직접 추가/수정/삭제한다.
// 여기서 저장한 가격은 부품 찾아보기 카드의 "판매처 가격"(/api/parts/listings-summary)에 바로 반영된다.
// 관리자가 직접 확인한 실제 상품 페이지 주소와 가격만 넣는다(서버가 http(s)/검색 결과 주소 여부를 다시 검사).
function AdminSellerListings() {
  const [rows, setRows] = useState(null)
  const [parts, setParts] = useState([])
  const [sellers, setSellers] = useState([])
  const [filterPartId, setFilterPartId] = useState('')
  const [partQuery, setPartQuery] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    api
      .get(`/api/admin/seller-listings${filterPartId ? `?partId=${filterPartId}` : ''}`)
      .then(setRows)
      .catch((err) => setError(err.message))
    api.get('/api/admin/seller-listings/sellers').then(setSellers).catch(() => setSellers([]))
  }

  useEffect(load, [filterPartId])
  useEffect(() => {
    api.get('/api/parts', { auth: false }).then((data) => setParts([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))).catch(() => setParts([]))
  }, [])

  const partOptions = useMemo(() => {
    const q = partQuery.trim().toLowerCase()
    const list = q ? parts.filter((p) => p.name.toLowerCase().includes(q) || String(p.id) === q) : parts
    // 수정 중인 부품은 검색어와 무관하게 선택지에 남긴다
    const selected = parts.find((p) => String(p.id) === String(form.partId))
    return selected && !list.includes(selected) ? [selected, ...list] : list
  }, [parts, partQuery, form.partId])

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const resetForm = () => {
    setForm({ ...EMPTY, checkedAt: today() })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!form.partId) return setError('부품을 선택해주세요.')
    if (!form.sellerName.trim()) return setError('판매처 이름을 입력해주세요.')
    if (!form.price || Number(form.price) <= 0) return setError('가격을 1원 이상으로 입력해주세요.')
    const body = {
      partId: Number(form.partId),
      sellerName: form.sellerName.trim(),
      price: Number(form.price),
      sourceUrl: form.sourceUrl.trim() || null,
      checkedAt: form.checkedAt,
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await api.put(`/api/admin/seller-listings/${editingId}`, body)
        setNotice('수정했어요. 부품 찾아보기 카드에 바로 반영돼요.')
      } else {
        await api.post('/api/admin/seller-listings', body)
        setNotice('추가했어요. 부품 찾아보기 카드에 바로 반영돼요.')
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setNotice(null)
    setError(null)
    setForm({
      partId: String(row.partId),
      sellerName: row.sellerName ?? '',
      price: row.price != null ? String(row.price) : '',
      sourceUrl: row.sourceUrl ?? '',
      checkedAt: row.checkedAt ? row.checkedAt.slice(0, 10) : today(),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`${row.partName} / ${row.sellerName} 가격을 삭제할까요?`)) return
    try {
      await api.del(`/api/admin/seller-listings/${row.id}`)
      if (editingId === row.id) resetForm()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="admin-seller-listings">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-4" data-testid="seller-form">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-ridefit-text">{editingId ? `판매처 가격 수정 (#${editingId})` : '판매처 가격 추가'}</p>
          <p className="text-xs text-ridefit-text-secondary">직접 확인한 실제 판매가와 상품 페이지 주소만 넣어주세요. 실시간으로 갱신되지 않아요.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ridefit-text-secondary">
            부품
            <input value={partQuery} onChange={(e) => setPartQuery(e.target.value)} placeholder="부품 이름/ID로 찾기" className={inputClass} data-testid="seller-part-search" />
            <select value={form.partId} onChange={set('partId')} className={inputClass} data-testid="seller-part">
              <option value="">부품 선택 ({partOptions.length}개)</option>
              {partOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ridefit-text-secondary">
            판매처 (기존 판매처를 고르거나 새 이름을 입력)
            <input list="seller-names" value={form.sellerName} onChange={set('sellerName')} placeholder="예: 쿠팡, G마켓, 11번가" className={inputClass} data-testid="seller-name" />
            <datalist id="seller-names">
              {sellers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ridefit-text-secondary">
            가격(원)
            <input type="number" min="1" step="1" value={form.price} onChange={set('price')} placeholder="189000" className={inputClass} data-testid="seller-price" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ridefit-text-secondary">
            가격 확인일
            <input type="date" max={today()} value={form.checkedAt} onChange={set('checkedAt')} className={inputClass} data-testid="seller-checked" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ridefit-text-secondary sm:col-span-2">
            상품 URL (실제 상품 페이지, 검색 결과 주소 불가 · 없으면 비워두면 가격만 표시)
            <input type="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="https://..." className={inputClass} data-testid="seller-url" />
          </label>
        </div>
        {error && <p className="text-sm text-ridefit-danger" data-testid="seller-error">{error}</p>}
        {notice && <p className="text-sm text-ridefit-success" data-testid="seller-notice">{notice}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50" data-testid="seller-submit">
            {submitting ? '저장 중...' : editingId ? '수정 저장' : '추가'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-ridefit-border px-4 py-2 text-sm text-ridefit-text-secondary">
              취소
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ridefit-text-secondary">부품 필터</span>
        <select value={filterPartId} onChange={(e) => setFilterPartId(e.target.value)} className={`${inputClass} !w-auto max-w-full`} data-testid="seller-filter">
          <option value="">전체</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} {p.name}
            </option>
          ))}
        </select>
        {rows && <span className="text-xs text-ridefit-text-secondary">{rows.length}건</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-ridefit-border">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="seller-table">
          <thead className="bg-ridefit-card text-xs text-ridefit-text-secondary">
            <tr>
              <th className="px-3 py-2">부품</th>
              <th className="px-3 py-2">판매처</th>
              <th className="px-3 py-2 text-right">가격</th>
              <th className="px-3 py-2">확인일</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ridefit-text-secondary">등록된 판매처 가격이 없어요.</td>
              </tr>
            )}
            {rows?.map((row) => (
              <tr key={row.id} className={`border-t border-ridefit-border ${editingId === row.id ? 'bg-ridefit-primary/10' : ''}`} data-testid={`seller-row-${row.id}`}>
                <td className="px-3 py-2 text-ridefit-text">
                  <span className="text-xs text-ridefit-text-secondary">#{row.partId}</span> {row.partName}
                </td>
                <td className="px-3 py-2 text-ridefit-text">
                  {row.sellerName}
                  {row.sample && <span className="ml-1 text-[10px] text-ridefit-text-secondary">(예시 데이터)</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-ridefit-text">{row.price != null ? `${row.price.toLocaleString()}원` : '가격 확인 필요'}</td>
                <td className="px-3 py-2 text-ridefit-text-secondary">{formatDay(row.checkedAt)}</td>
                <td className="px-3 py-2">
                  {row.sourceUrl ? (
                    <a href={row.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-ridefit-primary hover:underline">
                      있음 <Ico as={ExternalLink} />
                    </a>
                  ) : (
                    <span className="text-ridefit-text-secondary">없음</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" onClick={() => startEdit(row)} className="mr-2 text-xs text-ridefit-primary hover:underline" data-testid={`seller-edit-${row.id}`}>
                    수정
                  </button>
                  <button type="button" onClick={() => handleDelete(row)} className="text-xs text-ridefit-danger hover:underline" data-testid={`seller-delete-${row.id}`}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminSellerListings
