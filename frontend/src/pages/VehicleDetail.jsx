import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SimilarVehicles from '../components/SimilarVehicles'
import TraitBars from '../components/TraitBars'
import VehicleImage from '../components/VehicleImage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { loadPartCategorySlugs } from '../lib/guide'
import { addRecentVehicle } from '../lib/recentVehicles'

const STATUS_STYLE = {
  호환가능: 'text-ridefit-success',
  브라켓필요: 'text-ridefit-warning',
  호환불가: 'text-ridefit-danger',
}

// 차량 상세: 스펙/성향 -> 관심 차량·내 차고 추가 -> 호환 부품 -> 비슷한 차량으로 이어지는 허브 화면.
function VehicleDetail() {
  const { vehicleId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [detail, setDetail] = useState(null)
  const [parts, setParts] = useState([])
  const [categorySlugs, setCategorySlugs] = useState({})
  const [maintenanceSpecs, setMaintenanceSpecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [interested, setInterested] = useState(false)
  const [interestBusy, setInterestBusy] = useState(false)
  const [yearId, setYearId] = useState('')
  const [adding, setAdding] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setActionMessage(null)
    Promise.all([
      api.get(`/api/vehicles/${vehicleId}`, { auth: false }),
      api.get(`/api/vehicles/${vehicleId}/parts`, { auth: false }),
      loadPartCategorySlugs(),
      api.get(`/api/vehicle-models/${vehicleId}/maintenance-specs`, { auth: false }).catch(() => []),
    ])
      .then(([detailData, partData, slugs, specs]) => {
        setDetail(detailData)
        setParts(partData)
        setCategorySlugs(slugs)
        setMaintenanceSpecs(specs ?? [])
        setYearId('')
        addRecentVehicle(detailData.vehicle.id)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [vehicleId])

  useEffect(() => {
    if (!isAuthenticated) {
      setInterested(false)
      return
    }
    api
      .get('/api/me/vehicle-interests')
      .then((list) => setInterested(list.some((v) => String(v.id) === String(vehicleId))))
      .catch(() => setInterested(false))
  }, [vehicleId, isAuthenticated])

  const toggleInterest = async () => {
    setInterestBusy(true)
    setActionMessage(null)
    try {
      if (interested) {
        await api.del(`/api/me/vehicle-interests/${vehicleId}`)
        setInterested(false)
      } else {
        await api.post('/api/me/vehicle-interests', { vehicleModelId: Number(vehicleId) })
        setInterested(true)
      }
    } catch (err) {
      setActionMessage(err.message)
    } finally {
      setInterestBusy(false)
    }
  }

  const addToGarage = async () => {
    if (!yearId) {
      setActionMessage('연식을 먼저 선택해주세요.')
      return
    }
    setAdding(true)
    setActionMessage(null)
    try {
      await api.post('/api/my-vehicles', { modelYearId: Number(yearId) })
      navigate('/garage')
    } catch (err) {
      setActionMessage(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-5xl px-4 py-16 text-ridefit-text-secondary">불러오는 중...</p>
  if (error) return <p className="mx-auto max-w-5xl px-4 py-16 text-red-600">에러: {error}</p>
  if (!detail) return null

  const { vehicle, pros, cons, years } = detail
  const partsByCategory = parts.reduce((acc, part) => {
    ;(acc[part.category] ??= []).push(part)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-ridefit-text-secondary">
        <Link to="/vehicles" className="hover:text-ridefit-primary">
          차량 둘러보기
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ridefit-text">{vehicle.name}</span>
      </nav>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card shadow-lg">
          <VehicleImage vehicle={vehicle} className="h-64 w-full bg-ridefit-bg" />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ridefit-primary">{vehicle.manufacturerName}</p>
          <h1 className="text-3xl font-bold text-ridefit-text">{vehicle.name}</h1>
          <div className="flex flex-wrap gap-1.5 text-xs text-ridefit-text-secondary">
            {vehicle.bodyStyle && <span className="rounded-full border border-ridefit-border px-2.5 py-1">{vehicle.bodyStyle}</span>}
            {vehicle.displacementCc && <span className="rounded-full border border-ridefit-border px-2.5 py-1">{vehicle.displacementCc}cc</span>}
            {vehicle.priceTierLabel && <span className="rounded-full border border-ridefit-border px-2.5 py-1">가격대 {vehicle.priceTierLabel}</span>}
          </div>
          {vehicle.summary && <p className="text-ridefit-text-secondary">{vehicle.summary}</p>}

          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-ridefit-border bg-ridefit-card p-4 shadow-lg">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={toggleInterest}
                  disabled={interestBusy}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    interested
                      ? 'border-ridefit-primary bg-ridefit-primary/15 text-ridefit-primary'
                      : 'border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary'
                  }`}
                >
                  {interested ? '♥ 관심 차량 등록됨' : '♡ 관심 차량으로 등록'}
                </button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={yearId}
                    onChange={(e) => setYearId(e.target.value)}
                    aria-label="연식 선택"
                    className="flex-1 rounded-lg border border-ridefit-border bg-ridefit-bg px-3 py-2 text-sm text-ridefit-text focus:border-ridefit-primary focus:outline-none focus:ring-1 focus:ring-ridefit-primary"
                  >
                    <option value="">연식 선택</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.year}
                        {y.chassisCode ? ` (${y.chassisCode})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addToGarage}
                    disabled={adding}
                    className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {adding ? '추가 중...' : '내 차고에 추가'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ridefit-text-secondary">
                <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
                  로그인
                </Link>
                하면 관심 차량으로 등록하거나 내 차고에 추가할 수 있어요.
              </p>
            )}
            {actionMessage && <p className="text-sm text-red-600">{actionMessage}</p>}
          </div>
        </div>
      </section>

      {vehicle.traitScores && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-ridefit-text">라이딩 성향</h2>
          <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
            <TraitBars scores={vehicle.traitScores} />
          </div>
        </section>
      )}

      {(pros.length > 0 || cons.length > 0) && (
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
            <h2 className="mb-3 font-bold text-ridefit-text">이런 점이 좋아요</h2>
            <ul className="flex flex-col gap-2 text-sm text-ridefit-text-secondary">
              {pros.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-green-700" aria-hidden="true">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
            <h2 className="mb-3 font-bold text-ridefit-text">고려할 점</h2>
            <ul className="flex flex-col gap-2 text-sm text-ridefit-text-secondary">
              {cons.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-yellow-700" aria-hidden="true">
                    !
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {maintenanceSpecs.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-xl font-bold text-ridefit-text">정비 · 소모품 정보</h2>
          <p className="mb-4 text-sm text-ridefit-text-secondary">이 차량에 맞는 제조사 권장값만 모았어요.</p>
          <div className="flex flex-col gap-4">
            {maintenanceSpecs.map((spec) => (
              <div key={spec.id} className="rounded-xl border border-ridefit-border bg-ridefit-card p-5 shadow-lg">
                <h3 className="font-semibold text-ridefit-text">{spec.itemName}</h3>
                <p className="mt-1 text-sm text-ridefit-text">{spec.specSummary}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  {spec.changeVolumeL != null && (
                    <div>
                      <dt className="text-xs text-ridefit-text-secondary">교환유량</dt>
                      <dd className="font-medium text-ridefit-text">{spec.changeVolumeL}L</dd>
                    </div>
                  )}
                  {spec.changeVolumeWithFilterL != null && (
                    <div>
                      <dt className="text-xs text-ridefit-text-secondary">필터 교환 시</dt>
                      <dd className="font-medium text-ridefit-text">{spec.changeVolumeWithFilterL}L</dd>
                    </div>
                  )}
                  {spec.firstIntervalKm != null && (
                    <div>
                      <dt className="text-xs text-ridefit-text-secondary">최초 교환</dt>
                      <dd className="font-medium text-ridefit-text">
                        {spec.firstIntervalKm.toLocaleString()}km / {spec.firstIntervalMonths}개월
                      </dd>
                    </div>
                  )}
                  {spec.intervalKm != null && (
                    <div>
                      <dt className="text-xs text-ridefit-text-secondary">이후 교환 주기</dt>
                      <dd className="font-medium text-ridefit-text">
                        {spec.intervalKm.toLocaleString()}km / {spec.intervalMonths}개월
                      </dd>
                    </div>
                  )}
                </dl>
                {spec.note && (
                  <p className="mt-3 rounded-lg border border-ridefit-warning-border bg-ridefit-warning-bg px-3 py-2 text-xs text-ridefit-warning">
                    {spec.note}
                  </p>
                )}
                <p className="mt-2 text-xs text-ridefit-text-secondary">
                  출처: {spec.sourceLabel}
                  {spec.sourceUrl && (
                    <>
                      {' · '}
                      <a href={spec.sourceUrl} target="_blank" rel="noreferrer" className="text-ridefit-primary hover:underline">
                        원문 보기
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-ridefit-text">연식 · 세대</h2>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <span key={y.id} className="rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-sm text-ridefit-text">
                {y.year}
                {y.chassisCode && <span className="ml-2 font-mono text-xs text-ridefit-primary">{y.chassisCode}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-1 text-xl font-bold text-ridefit-text">호환 부품</h2>
        <p className="mb-4 text-sm text-ridefit-text-secondary">이 차량에 호환 데이터가 등록된 부품이에요. 부품 종류를 눌러 자세한 정보를 확인해보세요.</p>

        {parts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-4 py-6 text-sm text-ridefit-text-secondary">
            아직 이 차량의 호환 부품 데이터가 준비되지 않았어요. 데이터가 등록되면 이곳에 표시됩니다.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(partsByCategory).map(([category, list]) => (
              <div key={category}>
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="font-semibold text-ridefit-text">{category}</h3>
                  {categorySlugs[category] && (
                    <Link to={`/guide/${categorySlugs[category]}`} className="text-xs font-medium text-ridefit-primary hover:underline">
                      {category} 알아보기 →
                    </Link>
                  )}
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((part) => (
                    <li key={part.partId}>
                      <Link
                        to={`/parts/${part.partId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ridefit-border bg-ridefit-card px-4 py-3 transition hover:border-ridefit-primary"
                      >
                        <span className="text-sm text-ridefit-text">{part.name}</span>
                        <span className="shrink-0 text-xs">
                          {part.years.map((y) => (
                            <span key={y.year} className={`ml-2 ${STATUS_STYLE[y.status] ?? 'text-ridefit-text-secondary'}`}>
                              {y.year} {y.status}
                            </span>
                          ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <SimilarVehicles
        className="mt-14"
        ids={[vehicle.id]}
        title="이 차량과 비슷한 차량"
        description="배기량, 차체 형태, 가격대, 라이딩 성향을 비교해서 골랐어요."
      />

      <p className="mt-10 text-xs text-ridefit-text-secondary">
        스펙·성향·가격대 분류는 개발용 초기 데이터예요. 실제 구매 전에는 제조사 공식 정보를 확인해주세요.
      </p>
    </div>
  )
}

export default VehicleDetail
