import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { api } from '../lib/api'
import { clearFitData } from '../lib/fitBuild'

// 내 차고 차량 삭제(DELETE /api/my-vehicles/{id}, 본인 차량만 - 서버가 확인).
// 확인 창에는 서버의 실제 삭제 정책을 그대로 알린다(MyVehicleController.deleteMyVehicle):
//  - 이 차량에 즐겨찾기한 부품, 부품 확인 기록: 함께 삭제
//  - 예약·주문·게시글: 기록은 남고 차량 연결만 끊김
//  - 저장한 장착 모습: 서버에 남지만 차량이 없어 더 이상 볼 수 없음(지우려면 먼저 삭제)
// 실패하면 화면에서 차량을 빼지 않고 오류만 보여준다. 요청 중에는 다시 누를 수 없다.
function VehicleDeleteButton({ vehicle, onDeleted, className = '' }) {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState(null) // { favorites, savedFits } | null(불러오는 중/실패)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const name = vehicle.nickname || vehicle.modelYearLabel

  const openDialog = () => {
    setError('')
    setCounts(null)
    setOpen(true)
    Promise.all([
      api.get(`/api/me/favorites?myVehicleId=${vehicle.id}`),
      api.get(`/api/ai-fit/results?myVehicleId=${vehicle.id}`),
    ])
      .then(([favs, fits]) => setCounts({ favorites: favs.length, savedFits: fits.length }))
      .catch(() => setCounts(null))
  }

  const confirm = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await api.del(`/api/my-vehicles/${vehicle.id}`)
      clearFitData(vehicle.id)
      setOpen(false)
      onDeleted?.(vehicle.id)
    } catch (err) {
      setOpen(false)
      setError(`차량을 삭제하지 못했어요. ${err.message ?? ''}`.trim())
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const n = (v) => (counts ? ` ${v}개` : '')
  const message = (
    <>
      <span className="block font-semibold text-ridefit-text" data-testid="vehicle-delete-name">{name}</span>
      <span className="mt-2 block">함께 삭제: 이 차량의 즐겨찾기{n(counts?.favorites)}, 부품 확인 기록</span>
      {(!counts || counts.savedFits > 0) && (
        <span className="mt-1 block">
          볼 수 없게 됨: 저장한 장착 모습{n(counts?.savedFits)} (지우려면 먼저 삭제해 주세요)
        </span>
      )}
      <span className="mt-1 block">남는 기록: 예약·주문·게시글</span>
      <span className="mt-1 block text-ridefit-danger">삭제하면 되돌릴 수 없어요.</span>
    </>
  )

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openDialog}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ridefit-danger-border px-3 py-2.5 text-sm font-semibold text-ridefit-danger transition hover:bg-ridefit-danger-bg disabled:opacity-50"
        data-testid={`vehicle-delete-${vehicle.id}`}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        {busy ? '삭제 중...' : '차량 삭제'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-ridefit-danger" role="alert" data-testid="vehicle-delete-error">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title="이 차량을 삭제할까요?"
        message={message}
        confirmLabel="삭제"
        cancelLabel="취소"
        danger
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

export default VehicleDeleteButton
