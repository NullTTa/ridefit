import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-semibold text-ridefit-primary">404</p>
      <h1 className="text-2xl font-bold text-ridefit-text">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-ridefit-text-secondary">주소가 잘못되었거나, 이동되었거나, 삭제된 페이지예요.</p>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-ridefit-primary px-5 py-2.5 font-semibold text-white transition hover:brightness-110"
      >
        홈으로 돌아가기
      </Link>
    </div>
  )
}

export default NotFound
