import { Link } from 'react-router-dom'

const FEATURES = [
  {
    title: '정확한 호환성 확인',
    description: 'AI 추측이 아닌, 실제 데이터 기반으로 판정합니다.',
  },
  {
    title: '다양한 부품 검색',
    description: '카테고리별로 필요한 부품을 빠르게 찾아보세요.',
  },
  {
    title: '장착 미리보기',
    description: '부품을 장착한 모습을 미리 확인하는 기능을 준비 중입니다.',
    badge: 'Coming soon',
  },
]

function Home() {
  return (
    <div>
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
        <h1 className="text-4xl font-bold text-ridefit-text-light dark:text-ridefit-text-dark sm:text-5xl">
          내 차량에 맞는 부품을, 확실하게.
        </h1>
        <p className="max-w-xl text-lg text-gray-600 dark:text-gray-300">
          차량 모델과 연식만 등록하면, 실제 호환 데이터를 기반으로 맞는 부품을 바로 확인할 수 있습니다.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/my-vehicle/new"
            className="rounded-lg bg-ridefit-primary px-6 py-3 font-semibold text-white transition hover:brightness-110"
          >
            내 차량 등록하기
          </Link>
          <Link
            to="/parts"
            className="rounded-lg border border-ridefit-primary px-6 py-3 font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10"
          >
            부품 둘러보기
          </Link>
        </div>
      </section>

      <section className="bg-ridefit-bg-light-alt dark:bg-ridefit-bg-dark-alt">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="relative rounded-xl bg-white p-6 shadow-md transition hover:-translate-y-1 dark:bg-ridefit-bg-dark"
            >
              {feature.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-ridefit-primary/10 px-2 py-1 text-xs font-semibold text-ridefit-primary">
                  {feature.badge}
                </span>
              )}
              <h2 className="mb-2 text-lg font-bold text-ridefit-text-light dark:text-ridefit-text-dark">
                {feature.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
