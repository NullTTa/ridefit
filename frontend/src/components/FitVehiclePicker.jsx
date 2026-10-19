import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { fitRoomPath } from '../lib/fitRoom'

// "내 차에 장착해보기" - 이 부품을 선택한 상태로 내 차량의 FitRoom을 연다(합성은 FitRoom에서 [합성하기]).
//  - 내 차량별 호환 여부는 기존 API(/api/my-vehicles/compatible-summary, 호환가능·브라켓필요만)로 확인해 목록에 표시한다.
//    호환이 확인된 차량 1대뿐이면 바로 이동, 그 밖에는 목록(호환 안 된 차량은 고를 수 없음) / 차량 없음: 등록 안내.
//  - 요약을 못 불러오면 예전처럼 고르게 하고, FitRoom이 그 차량의 호환 부품 목록으로 다시 확인한다(호환 안 되면 선택하지 않음).
// vehicles: 이미 내 차량 목록을 가진 화면은 넘겨주고(재요청 안 함), 없으면 누를 때 /api/my-vehicles를 부른다.
// currentVehicleId: 지금 보고 있는 차량(목록 맨 위에 "지금 보고 있는 차량"으로 표시).
function FitVehiclePicker({ partId, vehicles: givenVehicles, currentVehicleId, className = '', buttonClassName }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [vehicles, setVehicles] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // 차량 id -> 이 부품과 호환(장착 가능) 여부. null이면 확인 못 함(요약 API 실패).
  const [fits, setFits] = useState(null)

  const choose = (list, fitMap) => {
    const ok = fitMap ? list.filter((v) => fitMap.get(String(v.id))) : list
    if (list.length === 1 && ok.length === 1) {
      navigate(fitRoomPath(list[0].id, partId))
      return
    }
    setVehicles(list)
    setFits(fitMap)
    setOpen(true)
  }

  const handleClick = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const [list, summary] = await Promise.all([
        givenVehicles ?? api.get('/api/my-vehicles'),
        api.get('/api/my-vehicles/compatible-summary').catch(() => null),
      ])
      const fitMap = summary
        ? new Map(summary.map((s) => [String(s.myVehicleId), s.parts.some((p) => String(p.partId) === String(partId))]))
        : null
      choose(list, fitMap)
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
              {fits && !sorted.some((v) => fits.get(String(v.id))) && (
                <p className="mb-2 rounded-md border border-ridefit-warning-border bg-ridefit-warning-bg px-2.5 py-1.5 text-xs text-ridefit-warning" data-testid="fit-picker-none">
                  등록한 차량 중 호환이 확인된 차량이 없어요.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                {sorted.map((v) => {
                  const compatible = !fits || fits.get(String(v.id))
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => compatible && navigate(fitRoomPath(v.id, partId))}
                      disabled={!compatible}
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-ridefit-border bg-ridefit-card px-3 py-2 text-left text-sm text-ridefit-text transition hover:border-ridefit-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-ridefit-border"
                      data-testid={`fit-picker-vehicle-${v.id}`}
                      data-compatible={compatible ? 'true' : 'false'}
                    >
                      <span className="wrap-name min-w-0">
                        {v.nickname || v.modelYearLabel}
                        {v.nickname && <span className="ml-1 text-xs text-ridefit-text-secondary">{v.modelYearLabel}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-[11px] font-medium">
                        {fits && (compatible
                          ? <span className="text-ridefit-success">장착 가능</span>
                          : <span className="text-ridefit-warning">호환 확인 안 됨</span>)}
                        {String(v.id) === String(currentVehicleId) && <span className="text-ridefit-primary">지금 보고 있는 차량</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default FitVehiclePicker
