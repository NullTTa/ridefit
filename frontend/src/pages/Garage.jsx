import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SimilarVehicles from '../components/SimilarVehicles'
import { VEHICLE_PLACEHOLDER_IMAGE } from '../constants/images'
import { api } from '../lib/api'

function Garage() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = () => {
    setLoading(true)
    api
      .get('/api/my-vehicles')
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id) => {
    if (!window.confirm('이 차량을 차고에서 삭제할까요?')) return
    setDeletingId(id)
    try {
      await api.del(`/api/my-vehicles/${id}`)
      setVehicles((prev) => prev.filter((v) => v.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ridefit-text">내 차고</h1>
        <Link
          to="/garage/new"
          className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          + 차량 등록
        </Link>
      </div>

      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="text-ridefit-danger">에러: {error}</p>}

      {!loading && !error && vehicles.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-16 text-center">
          <p className="text-ridefit-text-secondary">아직 등록된 차량이 없어요.</p>
          <Link
            to="/garage/new"
            className="rounded-lg bg-ridefit-primary px-4 py-2 font-semibold text-white transition hover:brightness-110"
          >
            첫 차량 등록하기
          </Link>
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card shadow-lg transition hover:-translate-y-1"
            >
              <img
                src={vehicle.photoUrl || vehicle.modelImageUrl || VEHICLE_PLACEHOLDER_IMAGE}
                alt={vehicle.nickname || vehicle.modelYearLabel}
                className="h-40 w-full object-contain bg-ridefit-bg-alt p-2"
              />
              <div className="p-4">
                <p className="text-xs font-medium text-ridefit-primary">{vehicle.manufacturerName}</p>
                <p className="mt-1 text-lg font-semibold text-ridefit-text">{vehicle.nickname || vehicle.modelYearLabel}</p>
                {vehicle.nickname && <p className="text-xs text-ridefit-text-secondary">{vehicle.modelYearLabel}</p>}
                <Link to={`/vehicles/${vehicle.vehicleModelId}`} className="mt-1 inline-block text-xs font-medium text-ridefit-primary hover:underline">
                  차량 정보 · 비슷한 차량 보기 →
                </Link>

                <Link
                  to={`/garage/${vehicle.id}/fit`}
                  className="mt-4 block rounded-lg bg-ridefit-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110"
                >
                  부품 입혀보기
                </Link>

                <div className="mt-2 flex gap-2">
                  <Link
                    to={`/parts/import?vehicleId=${vehicle.id}`}
                    className="flex-1 rounded-lg bg-ridefit-primary/10 px-3 py-2 text-center text-sm font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/20"
                  >
                    부품 링크 확인
                  </Link>
                  <Link
                    to={`/parts?vehicleId=${vehicle.id}`}
                    className="flex-1 rounded-lg border border-ridefit-border px-3 py-2 text-center text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
                  >
                    부품 찾아보기
                  </Link>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <Link
                    to={`/garage/${vehicle.id}/edit`}
                    className="text-xs font-medium text-ridefit-text-secondary hover:text-ridefit-primary"
                  >
                    차량 수정
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(vehicle.id)}
                    disabled={deletingId === vehicle.id}
                    className="text-xs text-ridefit-text-secondary hover:text-ridefit-danger disabled:opacity-50"
                  >
                    {deletingId === vehicle.id ? '삭제 중...' : '차고에서 삭제'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <SimilarVehicles
          className="mt-16"
          ids={[...new Set(vehicles.map((v) => v.vehicleModelId))]}
          title="내 차량과 비슷한 차량"
          description="내 차고의 차량과 배기량, 차체 형태, 가격대, 라이딩 성향이 비슷한 차량이에요."
        />
      )}
    </div>
  )
}

export default Garage
