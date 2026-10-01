import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { fitRoomPath } from '../lib/fitRoom'

// "내 차에 장착해보기" - 이 부품을 켠 상태로 내 차량의 FitRoom을 연다.
//  - 차량 1대: 바로 이동 / 여러 대: 아래에 차량 선택 목록 / 없음: 차량 등록 안내.
//  - 호환 여부는 여기서 판정하지 않는다. FitRoom이 그 차량의 호환 부품 목록으로 다시 확인하고,
//    호환되지 않으면 자동 선택하지 않고 안내만 보여준다.
// vehicles: 이미 내 차량 목록을 가진 화면은 넘겨주고(재요청 안 함), 없으면 누를 때 /api/my-vehicles를 부른다.
// currentVehicleId: 지금 보고 있는 차량(목록 맨 위에 "지금 보고 있는 차량"으로 표시).
function FitVehiclePicker({ partId, vehicles: givenVehicles, currentVehicleId, className = '', buttonClassName }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [vehicles, setVehicles] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const choose = (list) => {
    if (list.length === 1) {
      navigate(fitRoomPath(list[0].id, partId))
      return
    }
    setVehicles(list)
    setOpen(true)
  }

  const handleClick = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setError(null)
    if (givenVehicles) {
      choose(givenVehicles)
      return
    }
    setLoading(true)
    try {
      choose(await api.get('/api/my-vehicles'))
    } catch (err) {
      setError(err.message)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const sorted = [...(vehicles ?? [])].sort(
    (a, b) => (String(b.id) === String(currentVehicleId)) - (String(a.id) === String(currentVehicleId)),
  )

  return (
    // 목록이 열리면 한 줄을 다 쓰게 해서(flex 부모 안) 좁은 화면에서도 차량 이름이 잘리지 않게 한다.
    <div className={`${className} ${open ? 'basis-full' : ''}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-expanded={open}
        className={
          buttonClassName ??
          'rounded-lg bg-ridefit-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50'
        }
        data-testid={`fit-try-${partId}`}
      >
        {loading ? '불러오는 중...' : '내 차에 장착해보기'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-ridefit-border bg-ridefit-bg p-3 text-left" data-testid="fit-vehicle-picker">
          {error ? (
            <p className="text-xs text-ridefit-danger">{error}</p>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-ridefit-text-secondary">내 차량을 먼저 등록해주세요.</p>
              <Link
                to="/garage/new"
                className="rounded-lg bg-ridefit-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
              >
                내 차량 등록하기
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-ridefit-text">어떤 차량에 장착해볼까요?</p>
              <div className="flex flex-col gap-1.5">
                {sorted.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate(fitRoomPath(v.id, partId))}
                    className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-left text-sm text-ridefit-text transition hover:border-ridefit-primary"
                  >
                    <span className="min-w-0 truncate">
                      {v.nickname || v.modelYearLabel}
                      {v.nickname && <span className="ml-1 text-xs text-ridefit-text-secondary">{v.modelYearLabel}</span>}
                    </span>
                    {String(v.id) === String(currentVehicleId) && (
                      <span className="shrink-0 text-[11px] font-medium text-ridefit-primary">지금 보고 있는 차량</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default FitVehiclePicker
