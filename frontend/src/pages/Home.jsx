import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import PartBadges from '../components/PartBadges'
import Reveal from '../components/Reveal'
import SimilarVehicles from '../components/SimilarVehicles'
import VehicleCard from '../components/VehicleCard'
import VehicleHighlightAnimation from '../components/VehicleHighlightAnimation'
import VehicleImage from '../components/VehicleImage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getRecentVehicleIds } from '../lib/recentVehicles'

// 홈 하단에 소개할 정보 글(slug). 서버에 없으면 자동으로 빠진다.
const FEATURED_GUIDES = ['engine-oil', 'coolant', 'urea-solution', 'handle-damper', 'engine-oil-change', 'tire-pressure-check']

const SERVICE_FEATURES = [
  { title: '정확한 호환성 확인', description: '추측이 아닌, 등록된 호환 데이터를 기반으로 판정합니다.' },
  { title: '다양한 부품 검색', description: '카테고리별로 필요한 부품을 빠르게 찾아보세요.' },
  { title: 'AI 장착 미리보기', description: '부품을 장착한 모습을 AI로 미리 확인해보세요.' },
]

const JOURNEY = [
  { label: '차량 탐색', to: '/vehicles' },
  { label: '성향 테스트', to: '/finder' },
  { label: '비슷한 차량', to: '/vehicles' },
  { label: '부품 찾기', to: '/parts' },
  { label: '호환 확인', to: '/parts/import' },
  { label: '부품·소모품 정보', to: '/guide' },
  { label: 'DIY 가이드', to: '/guide?tab=DIY' },
  { label: '커뮤니티', to: '/community' },
  { label: '정비·예약', to: '/services' },
]

const SECTION_EMOJI = { VETERAN: '🏆', NEWBIE: '🌱', FREE: '💬' }

function SectionHead({ eyebrow, title, description, to, toLabel }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold text-ridefit-text sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm text-ridefit-text-secondary">{description}</p>}
      </div>
      {to && (
        <Link to={to} className="text-sm font-medium text-ridefit-primary hover:underline">
          {toLabel} →
        </Link>
      )}
    </div>
  )
}

function Home() {
  const { isAuthenticated, user } = useAuth()

  const [vehicles, setVehicles] = useState([])
  const [myVehicles, setMyVehicles] = useState([])
  const [popularParts, setPopularParts] = useState(null) // null = 로딩 중
  const [newParts, setNewParts] = useState([])
  const [guides, setGuides] = useState([])
  const [sections, setSections] = useState([])
  const [popularPosts, setPopularPosts] = useState([])
  const [recentIds] = useState(() => getRecentVehicleIds())

  useEffect(() => {
    api.get('/api/vehicles', { auth: false }).then(setVehicles).catch(() => setVehicles([]))
    api.get('/api/parts/popular?limit=4', { auth: false }).then(setPopularParts).catch(() => setPopularParts([]))
    api.get('/api/parts', { auth: false }).then((all) => setNewParts(all.slice(-4).reverse())).catch(() => setNewParts([]))
    api.get('/api/guide/articles', { auth: false }).then(setGuides).catch(() => setGuides([]))
    api.get('/api/posts/categories', { auth: false }).then(setSections).catch(() => setSections([]))
    api.get('/api/posts?sort=popular&size=4', { auth: false }).then((page) => setPopularPosts(page.content)).catch(() => setPopularPosts([]))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setMyVehicles([])
      return
    }
    api.get('/api/my-vehicles').then(setMyVehicles).catch(() => setMyVehicles([]))
  }, [isAuthenticated])

  const partCategories = guides.filter((g) => g.type === 'PART' && g.partCategory)
  const featuredGuides = FEATURED_GUIDES.map((slug) => guides.find((g) => g.slug === slug)).filter(Boolean)
  // 실사진이 있는 차량을 앞에 두고, 나머지는 서버 순서를 유지한다.
  const featuredVehicles = [...vehicles].sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl))).slice(0, 3)
  const showMyVehicles = isAuthenticated && myVehicles.length > 0
  const partsForShowcase = popularParts && popularParts.length > 0 ? popularParts.map((p) => ({ ...p.part, stats: p.stats })) : newParts
  const showcaseIsPopular = popularParts && popularParts.length > 0

  return (
    <div>
      {/* 1. Hero: 설계도 애니메이션 + 로그인/환영 */}
      <section className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <div className="relative flex min-h-[40vh] flex-[1.25] items-center justify-center overflow-hidden bg-ridefit-card md:min-h-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.16),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(255,107,53,0.12),transparent_50%)]" />
          <VehicleHighlightAnimation />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-14 md:py-16">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">MOBILITY PARTS SERVICE</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-ridefit-text sm:text-4xl">
                내 바이크에 맞는 부품,
                <br />
                설계도처럼 정확하게
              </h1>
              <p className="mt-3 text-sm text-ridefit-text-secondary">
                차량을 고르고, 호환 부품을 확인하고, 관리 정보와 커뮤니티까지 한곳에서 이어집니다.
              </p>
            </div>

            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ridefit-text-secondary">{user?.name}님, 다시 오셨네요.</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link to="/garage" className="flex-1 rounded-lg bg-ridefit-primary px-6 py-3 text-center font-semibold text-white transition hover:brightness-110">
                    내 차고 가기
                  </Link>
                  <Link to="/parts" className="flex-1 rounded-lg border border-ridefit-primary px-6 py-3 text-center font-semibold text-ridefit-primary transition hover:bg-ridefit-primary/10">
                    부품 찾아보기
                  </Link>
                </div>
                <Link to="/finder" className="text-center text-sm font-medium text-ridefit-primary hover:underline">
                  성향으로 나의 오토바이 찾기 →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link to="/finder" className="flex-1 rounded-lg bg-ridefit-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-110">
                    나의 오토바이 찾기
                  </Link>
                  <Link to="/vehicles" className="flex-1 rounded-lg border border-ridefit-border px-4 py-2.5 text-center text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary">
                    차량 둘러보기
                  </Link>
                </div>
                <LoginForm as="h2" description="차량 모델과 연식만 등록하면 바로 호환 부품을 확인할 수 있어요." />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. 내 차량 / 추천 차량 */}
      <section className="bg-ridefit-bg-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow={showMyVehicles ? 'MY GARAGE' : 'FIND YOUR BIKE'}
              title={showMyVehicles ? '내 차고' : '나에게 맞는 오토바이는?'}
              description={showMyVehicles ? '등록한 차량으로 호환 부품을 확인하고 입혀볼 수 있어요.' : '질문 몇 개로 라이딩 성향을 알아보고, 잘 맞는 차량을 추천받아보세요.'}
              to={showMyVehicles ? '/garage' : '/vehicles'}
              toLabel={showMyVehicles ? '내 차고 전체 보기' : '전체 차량 보기'}
            />
          </Reveal>

          <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
            <Reveal>
              <div className="flex h-full flex-col justify-between gap-6 rounded-xl border border-ridefit-primary/40 bg-ridefit-card p-6">
                <div>
                  <p className="text-3xl" aria-hidden="true">
                    🧭
                  </p>
                  <h3 className="mt-3 text-xl font-bold text-ridefit-text">성향으로 알아보는 나의 오토바이</h3>
                  <p className="mt-2 text-sm text-ridefit-text-secondary">
                    출퇴근·투어링·디자인·유지비… 9개 질문으로 나의 라이딩 성향과 추천 차량을 확인해요. 로그인 없이 1~2분이면 충분해요.
                  </p>
                </div>
                <Link to="/finder" className="rounded-lg bg-ridefit-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-110">
                  테스트 시작하기
                </Link>
              </div>
            </Reveal>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {showMyVehicles
                ? myVehicles.slice(0, 3).map((v, i) => (
                    <Reveal key={v.id} delay={i * 0.08}>
                      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ridefit-border bg-ridefit-card shadow-lg transition hover:-translate-y-1">
                        <VehicleImage vehicle={{ imageUrl: v.modelImageUrl, name: v.vehicleModelName, manufacturerName: v.manufacturerName }} className="h-32 w-full bg-ridefit-bg" />
                        <div className="flex flex-1 flex-col p-4">
                          <p className="text-xs font-medium text-ridefit-primary">{v.manufacturerName}</p>
                          <p className="font-semibold text-ridefit-text">{v.modelYearLabel}</p>
                          <Link to={`/parts?vehicleId=${v.id}`} className="mt-auto pt-3 text-xs font-medium text-ridefit-primary hover:underline">
                            호환 부품 보기 →
                          </Link>
                        </div>
                      </div>
                    </Reveal>
                  ))
                : featuredVehicles.map((v, i) => (
                    <Reveal key={v.id} delay={i * 0.08}>
                      <VehicleCard vehicle={v} />
                    </Reveal>
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. 부품 찾아보기 */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow="PARTS"
              title="부품 찾아보기"
              description="종류별로 부품이 무엇인지 알아보고, 내 차량에 호환되는 상품을 확인하세요."
              to="/parts"
              toLabel="내 차량 호환 부품"
            />
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {partCategories.map((g, i) => (
              <Reveal key={g.slug} delay={Math.min(i, 5) * 0.05}>
                <Link
                  to={`/guide/${g.slug}`}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border border-ridefit-border bg-ridefit-card px-3 py-5 text-center transition hover:-translate-y-1 hover:border-ridefit-primary/60"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {g.emoji}
                  </span>
                  <span className="text-sm font-semibold text-ridefit-text">{g.partCategory}</span>
                  <span className="text-xs text-ridefit-text-secondary">알아보기</span>
                </Link>
              </Reveal>
            ))}
            <Reveal delay={0.1}>
              <Link
                to="/parts/import"
                className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ridefit-primary/50 px-3 py-5 text-center transition hover:bg-ridefit-primary/10"
              >
                <span className="text-3xl" aria-hidden="true">
                  🔗
                </span>
                <span className="text-sm font-semibold text-ridefit-primary">링크로 호환 확인</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4. 인기 부품 */}
      <section className="bg-ridefit-bg-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow="POPULAR"
              title={showcaseIsPopular ? '인기 부품' : '새로 등록된 부품'}
              description={
                showcaseIsPopular
                  ? 'RIDEFIT에서 실제로 조회하고 장착해본 횟수를 기준으로 뽑았어요. (판매량이 아닙니다)'
                  : '아직 인기 순위를 매길 만큼 조회·장착 기록이 쌓이지 않았어요. 대신 새로 등록된 부품을 보여드려요.'
              }
              to="/parts"
              toLabel="부품 전체 보기"
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {partsForShowcase.map((part, i) => (
              <Reveal key={part.id} delay={i * 0.06}>
                <Link to={`/parts/${part.id}`} className="flex h-full flex-col rounded-xl border border-ridefit-border bg-ridefit-card p-4 transition hover:-translate-y-1 hover:border-ridefit-primary/60">
                  {part.imageUrl ? (
                    <img
                      src={part.imageUrl}
                      alt={part.name}
                      className="mb-3 h-28 w-full rounded-lg bg-white object-contain p-2"
                    />
                  ) : (
                    <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg bg-ridefit-bg text-xs text-ridefit-text-secondary">이미지 준비중</div>
                  )}
                  {part.stats?.badges?.length > 0 && (
                    <div className="mb-2">
                      <PartBadges badges={part.stats.badges} />
                    </div>
                  )}
                  <p className="text-xs font-medium text-ridefit-primary">{part.category}</p>
                  <p className="mt-0.5 font-semibold text-ridefit-text">{part.name}</p>
                  <p className="mt-auto pt-3 text-sm text-ridefit-text">{part.price.toLocaleString()}원</p>
                  {part.stats && (part.stats.viewCount > 0 || part.stats.fitSelectionCount > 0) && (
                    <p className="text-xs text-ridefit-text-secondary">
                      조회 {part.stats.viewCount} · 장착해보기 {part.stats.fitSelectionCount}
                    </p>
                  )}
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. 차량/부품 정보 */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow="GUIDE"
              title="알아두면 유용한 정보"
              description="엔진오일 점도, 냉각수, 핸들 댐퍼까지. 사기 전에 알아보고 달고 나서 관리하는 방법을 정리했어요."
              to="/guide"
              toLabel="정보 전체 보기"
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredGuides.map((g, i) => (
              <Reveal key={g.slug} delay={i * 0.06}>
                <Link to={`/guide/${g.slug}`} className="flex h-full gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-5 transition hover:-translate-y-1 hover:border-ridefit-primary/60">
                  <span className="text-3xl" aria-hidden="true">
                    {g.emoji}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ridefit-primary">{{ PART: '부품 정보', CONSUMABLE: '소모품 정보', DIY: 'DIY 가이드' }[g.type]}</p>
                    <p className="mt-0.5 font-semibold text-ridefit-text">{g.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ridefit-text-secondary">{g.summary}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 커뮤니티 */}
      <section className="bg-ridefit-bg-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow="COMMUNITY"
              title="라이더들이 머무는 곳"
              description="경험 많은 라이더의 노하우, 초보자의 질문, 자유로운 이야기까지."
              to="/community"
              toLabel="커뮤니티 가기"
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="grid gap-3">
              {sections.map((s, i) => (
                <Reveal key={s.code} delay={i * 0.06}>
                  <Link to={`/community?category=${s.code}`} className="flex items-center gap-4 rounded-xl border border-ridefit-border bg-ridefit-card p-4 transition hover:border-ridefit-primary/60">
                    <span className="text-2xl" aria-hidden="true">
                      {SECTION_EMOJI[s.code]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ridefit-text">{s.label}</p>
                      <p className="text-xs text-ridefit-text-secondary">{s.description}</p>
                    </div>
                    <span className="font-mono text-xs text-ridefit-text-secondary">{s.postCount}</span>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5">
                <p className="mb-3 text-sm font-semibold text-ridefit-text">추천 많은 글</p>
                {popularPosts.length === 0 ? (
                  <p className="text-sm text-ridefit-text-secondary">아직 게시글이 없어요.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-ridefit-border">
                    {popularPosts.map((post) => (
                      <li key={post.id}>
                        <Link to={`/community/${post.id}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-ridefit-primary">
                          <span className="min-w-0">
                            <span className="block text-xs text-ridefit-text-secondary">{post.categoryLabel}</span>
                            <span className="block truncate text-sm font-medium text-ridefit-text">{post.title}</span>
                          </span>
                          <span className="shrink-0 text-xs text-ridefit-text-secondary">
                            👍 {post.likeCount} · 💬 {post.commentCount}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7. 최근 본 차량과 비슷한 차량 */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            {recentIds.length > 0 ? (
              <SimilarVehicles
                ids={recentIds.slice(0, 3)}
                title="최근 본 차량과 비슷한 차량"
                description="최근 살펴본 차량과 배기량, 차체 형태, 가격대, 라이딩 성향이 비슷해요."
                limit={4}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 py-10 text-center">
                <h2 className="text-xl font-bold text-ridefit-text">최근 본 차량과 비슷한 차량</h2>
                <p className="mt-2 text-sm text-ridefit-text-secondary">
                  차량을 눌러 살펴보면 이곳에 비슷한 차량이 나타나요.
                </p>
                <Link to="/vehicles" className="mt-4 inline-block rounded-lg bg-ridefit-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                  차량 둘러보기
                </Link>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* 8. RIDEFIT 서비스 소개 */}
      <section className="bg-ridefit-bg-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal>
            <SectionHead eyebrow="ABOUT RIDEFIT" title="사고, 꾸미고, 관리하고, 소통하는 곳" description="차량 탐색부터 정비 예약 체험까지, 하나의 흐름으로 이어져요." />
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-3">
            {SERVICE_FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.08}>
                <div className="h-full rounded-xl border border-ridefit-border bg-ridefit-card p-6 shadow-lg transition hover:-translate-y-1">
                  <h3 className="mb-2 text-lg font-bold text-ridefit-text">{feature.title}</h3>
                  <p className="text-sm text-ridefit-text-secondary">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <ol className="mt-10 flex flex-wrap items-center gap-2">
              {JOURNEY.map((step, i) => (
                <li key={step.label} className="flex items-center gap-2">
                  <Link to={step.to} className="rounded-full border border-ridefit-border bg-ridefit-card px-3.5 py-1.5 text-sm text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary">
                    <span className="mr-1.5 font-mono text-xs text-ridefit-primary">{String(i + 1).padStart(2, '0')}</span>
                    {step.label}
                  </Link>
                  {i < JOURNEY.length - 1 && (
                    <span className="text-ridefit-text-secondary" aria-hidden="true">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

export default Home
