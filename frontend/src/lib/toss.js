import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'

// Toss Payments 클라이언트 키(공개 가능한 키). frontend/.env 의 VITE_TOSS_CLIENT_KEY 로만 넣는다(코드/깃 금지).
// 시크릿 키는 프론트에 절대 두지 않는다 - 결제 승인은 Spring Boot 서버(/api/payments/confirm)만 한다.
export const TOSS_CLIENT_KEY = (import.meta.env.VITE_TOSS_CLIENT_KEY || '').trim()

// missing: 키 없음 / live: 테스트 키가 아님(실결제 위험 - 결제창을 열지 않는다)
// widget: 결제위젯 연동 키(test_gck_) / api: API 개별 연동 키(test_ck_ - 결제창)
export function tossKeyMode() {
  if (!TOSS_CLIENT_KEY) return 'missing'
  if (!TOSS_CLIENT_KEY.startsWith('test_')) return 'live'
  return TOSS_CLIENT_KEY.startsWith('test_gck_') ? 'widget' : 'api'
}

export const TOSS_KEY_MESSAGE = {
  missing: '결제 설정이 아직 되지 않았어요. (VITE_TOSS_CLIENT_KEY 필요)',
  live: '테스트 결제 환경에서만 결제할 수 있어요.',
}

export function paymentRedirectUrls() {
  const origin = window.location.origin
  return { successUrl: `${origin}/payments/success`, failUrl: `${origin}/payments/fail` }
}

export function loadToss() {
  return loadTossPayments(TOSS_CLIENT_KEY)
}

export { ANONYMOUS }

// 결제창이 닫히거나(사용자 취소) 요청 단계에서 실패했을 때 SDK가 던지는 오류의 코드.
export function tossErrorCode(err) {
  return err?.code || 'UNKNOWN'
}

export const ORDER_TYPE_LABEL = { PART: '부품 구매', OIL: '오일/소모품 구매', SERVICE: '장착 서비스', RESERVATION: '정비·세차 예약' }
export const PAYMENT_STATUS_LABEL = { READY: '결제 대기', PAID: '결제 완료', FAILED: '결제 실패', CANCELED: '결제 취소' }

export function formatWon(value) {
  return value == null ? '-' : `${Number(value).toLocaleString()}원`
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
