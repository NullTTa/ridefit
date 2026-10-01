import { useState } from 'react'

// 외부/서버 이미지가 사라지거나 핫링크가 막혀도 깨진 이미지 아이콘 대신 안내 박스를 보여준다.
// src가 없거나 로드에 실패하면 fallbackText를 표시한다.
function SafeImage({ src, alt = '', className = '', fallbackClassName = '', fallbackText = '이미지 준비중', ...rest }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return (
      <div
        className={`flex items-center justify-center bg-ridefit-bg-alt text-center text-xs text-ridefit-text-secondary ${fallbackClassName || className}`}
        role="img"
        aria-label={alt || fallbackText}
      >
        {fallbackText}
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} {...rest} />
}

export default SafeImage
