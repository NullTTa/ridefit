import { Link } from 'react-router-dom'

// 비밀번호 찾기는 임시 중단 상태다. 예전에는 이메일+닉네임으로 본인 확인을 했는데, 닉네임은 커뮤니티에 공개돼
// 남의 계정 비밀번호를 바꿀 수 있었다. 이메일 인증을 붙이기 전까지는 안내만 보여 준다(서버 API도 503).
function FindPassword() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ridefit-text">비밀번호 찾기</h1>
          <p className="mt-2 text-sm text-ridefit-text-secondary">
            이메일 인증을 준비 중이라 지금은 이용할 수 없어요.
          </p>
          <p className="mt-2 text-sm text-ridefit-text-secondary">
            관리자에게 문의하거나, 로그인 상태라면 마이페이지에서 바꿀 수 있어요.
          </p>
        </div>

        <p className="text-sm text-ridefit-text-secondary">
          <Link to="/login" className="font-medium text-ridefit-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}

export default FindPassword
