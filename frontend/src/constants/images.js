import heroImg from '../assets/hero.png'

// 아직 대표 이미지가 등록되지 않은 차종(내 차고/부품 입혀보기/관리자 화면)에 보여줄 임시 아이콘.
// 특정 차량 사진이 아니라 "사진 없음" 상태를 나타내는 범용 아이콘이라 실물 사진으로 바꾸지 않는다.
export const VEHICLE_PLACEHOLDER_IMAGE = heroImg

// Home/로그인/회원가입의 부품 하이라이트 애니메이션에 쓰는 대표 이미지.
// 실제 등록 차량과 무관한 브랜딩용 이미지라, 지금 유일하게 확보된 실사진(Super Cub 110)을 사용한다.
export const HERO_ANIMATION_IMAGE = '/assets/vehicles/super-cub-110.png'

// 실제 RIDEFIT 로고(엠블럼 + 워드마크, 투명 배경). Header/Footer에서 CSS로 그리던
// "RF" 배지 + 텍스트를 대체한다. 원본 파일 그대로 사용 — 재생성/재압축하지 않는다.
export const RIDEFIT_LOGO_IMAGE = '/assets/brand/ridefit-logo.png'
