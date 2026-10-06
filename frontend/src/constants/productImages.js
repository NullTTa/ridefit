// 상품 사진 중 흰 배경/흰-회색 체커 무늬가 이미지에 박힌(RGB, 알파 없음) 것들의 "화면 표시용 정리본".
// 테두리와 이어진 무채색 밝은 영역만 투명하게 지운 사본이다(제품 안쪽 흰색/투명 스크린의 푸른 기는 유지, 원본 파일은 그대로).
// DB(Part.imageUrl)는 원본 경로를 그대로 두고, 화면에서만 이 표로 바꿔 보여준다.
// 주의: universal-scooter-windscreen.png 는 체커 무늬가 투명한 스크린 안쪽까지 박혀 있어 바깥만 지워졌다(안쪽 무늬는 남음).
export const CLEAN_PRODUCT_IMAGES = {
  '/assets/parts/kitaco-rear-carrier.png': '/assets/parts/clean/kitaco-rear-carrier.png',
  '/assets/parts/h2c-cub110-front-basket.png': '/assets/parts/clean/h2c-cub110-front-basket.png',
  '/assets/parts/h2c-cub110-windscreen.png': '/assets/parts/clean/h2c-cub110-windscreen.png',
  '/assets/parts/universal-scooter-windscreen.png': '/assets/parts/clean/universal-scooter-windscreen.png',
}

export const displayImageUrl = (src) => (src && CLEAN_PRODUCT_IMAGES[src]) || src
