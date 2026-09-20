// 차량 대표 이미지. imageUrl이 있으면 그대로 쓰고, 없으면 차체 형태에 맞춘 "라인 도면" 아이콘을 코드(SVG)로 그린다.
// 그래서 실제 사진 파일이 준비되지 않은 차종도 목록/상세가 비어 보이지 않는다.
// 사진이 준비되면 관리자 화면에서 차종 이미지를 등록하기만 하면 이 자리에 자동으로 적용된다.
function Silhouette({ bodyStyle }) {
  const sporty = bodyStyle && /네이키드|스포츠|어드벤처/.test(bodyStyle)
  const stroke = 'rgba(96,165,250,0.85)'
  return (
    <svg viewBox="0 0 240 120" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="52" cy="86" r="22" />
      <circle cx="52" cy="86" r="5" />
      <circle cx="190" cy="86" r="22" />
      <circle cx="190" cy="86" r="5" />
      {sporty ? (
        <>
          <path d="M52 86 L92 60 L138 58 L166 40 L190 86" />
          <path d="M92 60 L104 44 L134 44 L138 58" />
          <path d="M166 40 L176 30 L196 30" />
          <path d="M74 74 L124 74" />
        </>
      ) : (
        <>
          <path d="M52 86 L78 60 L122 60 L138 86" />
          <path d="M138 86 L150 44 L172 30" />
          <path d="M150 44 L178 44 L190 86" />
          <path d="M78 60 L96 46 L128 46 L122 60" />
          <path d="M172 30 L186 26" />
        </>
      )}
    </svg>
  )
}

function VehicleImage({ vehicle, className = '' }) {
  const alt = vehicle?.manufacturerName ? `${vehicle.manufacturerName} ${vehicle.name}` : vehicle?.name ?? '차량'
  if (vehicle?.imageUrl) {
    return <img src={vehicle.imageUrl} alt={alt} className={`object-contain ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center p-4 ${className}`} role="img" aria-label={`${alt} (사진 준비 중)`}>
      <Silhouette bodyStyle={vehicle?.bodyStyle} />
    </div>
  )
}

export default VehicleImage
