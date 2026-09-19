import { Link } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import VehicleHighlightAnimation from '../components/VehicleHighlightAnimation'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    title: '정확한 호환성 확인',
    description: '추측이 아닌, 등록된 데이터 기반으로 판정합니다.',
  },
  {
    title: '다양한 부품 검색',
    description: '카테고리별로 필요한 부품을 빠르게 찾아보세요.',
  },
  {
    title: 'AI 장착 미리보기',
    description: '부품을 장착한 모습을 AI로 미리 확인해보세요.',
  },
]

function Home() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div>
      {/* 로그인 화면과 같은 좌우 분할 구조를 뷰포트를 꽉 채우는 풀스크린 히어로로 재사용한다. */}
      <section className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-ridefit-card md:min-h-0">
          <VehicleHighlightAnimation />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-16">
          {isAuthenticated ? (
            <div className="flex w-full max-w-sm flex-col gap-6 text-center md:text-left">
              <div>
                <h1 className="text-2xl font-bold text-ridefit-text">{user?.name}님, 다시 오셨네요.</h1>
                <p className="mt-1 text-sm text-ridefit-text-secondary">
                  내 차고에서 등록한 차량과 호환 부품을 바로 확인해보세요.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/garage"
                  className="flex-1 rounded-lg bg-ridefit-primary px-6 py-3 text-center font-semibold text-white transition hover:brightness-110"
                >
                  내 차고 가기
                </Link>
                <Link
                  to="/parts"
                  className="flex-1 rounded-lg border border-ridefit-primary px-6 py-3 text-center font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10"
                >
                  부품 찾아보기
                </Link>
              </div>
            </div>
          ) : (
            <LoginForm description="차량 모델과 연식만 등록하면 바로 호환 부품을 확인할 수 있어요." />
          )}
        </div>
      </section>

      <section className="bg-ridefit-bg-alt">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg transition hover:-translate-y-1"
            >
              <h2 className="mb-2 text-lg font-bold text-ridefit-text">{feature.title}</h2>
              <p className="text-sm text-ridefit-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
