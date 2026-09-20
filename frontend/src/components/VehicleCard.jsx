import { Link } from 'react-router-dom'
import VehicleImage from './VehicleImage'

// 차량 카드. 목록, 추천 결과, 비슷한 차량, 홈에서 공통으로 쓴다.
// badge: 카드 우상단에 띄우는 문구(예: "일치 92%", "유사도 78%"). reasons: 하단에 보여줄 이유 목록.
function VehicleCard({ vehicle, badge, reasons, footer }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card shadow-lg transition hover:-translate-y-1 hover:border-ridefit-primary/60">
      <Link to={`/vehicles/${vehicle.id}`} className="relative block bg-ridefit-bg">
        <VehicleImage vehicle={vehicle} className="h-36 w-full" />
        {badge && (
          <span className="absolute right-2 top-2 rounded-full bg-ridefit-primary px-2.5 py-1 text-xs font-bold text-white shadow">
            {badge}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-ridefit-primary">{vehicle.manufacturerName}</p>
        <Link to={`/vehicles/${vehicle.id}`} className="mt-0.5 text-lg font-semibold text-ridefit-text hover:underline">
          {vehicle.name}
        </Link>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-ridefit-text-secondary">
          {vehicle.bodyStyle && <span className="rounded-full border border-ridefit-border px-2 py-0.5">{vehicle.bodyStyle}</span>}
          {vehicle.displacementCc && <span className="rounded-full border border-ridefit-border px-2 py-0.5">{vehicle.displacementCc}cc</span>}
          {vehicle.priceTierLabel && <span className="rounded-full border border-ridefit-border px-2 py-0.5">{vehicle.priceTierLabel}</span>}
        </div>

        {vehicle.summary && !reasons && (
          <p className="mt-3 line-clamp-3 text-sm text-ridefit-text-secondary">{vehicle.summary}</p>
        )}

        {reasons && reasons.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-ridefit-text-secondary">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-1.5">
                <span className="text-ridefit-primary" aria-hidden="true">
                  ✓
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </div>
    </div>
  )
}

export default VehicleCard
