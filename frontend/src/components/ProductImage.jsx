import { displayImageUrl } from '../constants/productImages'
import SafeImage from './SafeImage'

// 상품 카드 이미지 영역 공통: 흰 배경 사진(KITACO/H2C 등 RGB)과 투명 PNG가 섞여 있어도 카드마다 들쭉날쭉하지 않도록
// 모든 상품 이미지를 같은 크기/비율의 흰 판 위에 같은 여백·object-contain으로 놓는다(원본 이미지는 손대지 않음).
// 체커 무늬가 박힌 사진은 화면 표시용 정리본으로 바꿔 보여준다(constants/productImages.js).
// 이미지가 없으면 SafeImage의 "이미지 준비 중" 대체 박스를 같은 판 크기로 보여준다.
function ProductImage({ src, alt, className = '' }) {
  return (
    <div className={`aspect-[4/3] w-full overflow-hidden bg-white ${className}`}>
      <SafeImage
        src={displayImageUrl(src)}
        alt={alt}
        className="h-full w-full object-contain p-3"
        fallbackText="이미지 준비 중"
        fallbackClassName="h-full w-full !bg-white text-[11px] !text-slate-400"
      />
    </div>
  )
}

export default ProductImage
