import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import VehicleImage from '../components/VehicleImage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

// "성향으로 알아보는 나의 오토바이": 질문 9개 -> 나의 라이딩 성향 + DB의 차량 프로필과 비교한 추천 결과.
// 질문/점수 계산은 서버(FinderController)가 하고, 이 화면은 질문을 그리고 결과를 보여주기만 한다.
function Finder() {
  const { isAuthenticated } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [step, setStep] = useState(-1) // -1 소개, 0..n-1 질문, n 결과
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [interestIds, setInterestIds] = useState(new Set())
  const [interestMessage, setInterestMessage] = useState(null)

  useEffect(() => {
    api
      .get('/api/finder/questions', { auth: false })
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    api
      .get('/api/me/vehicle-interests')
      .then((list) => setInterestIds(new Set(list.map((v) => v.id))))
      .catch(() => {})
  }, [isAuthenticated])

  const total = questions.length
  const current = step >= 0 && step < total ? questions[step] : null

  const submit = async (finalAnswers) => {
    setSubmitting(true)
    setError(null)
    try {
      const data = await api.post(
        '/api/finder/result',
        { answers: Object.entries(finalAnswers).map(([questionId, optionId]) => ({ questionId, optionId })) },
        { auth: false },
      )
      setResult(data)
      setStep(total)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const choose = (optionId) => {
    const next = { ...answers, [current.id]: optionId }
    setAnswers(next)
    if (step + 1 >= total) {
      submit(next)
    } else {
      setStep(step + 1)
    }
  }

  const restart = () => {
    setAnswers({})
    setResult(null)
    setStep(-1)
    setError(null)
  }

  const toggleInterest = async (vehicleId) => {
    setInterestMessage(null)
    const has = interestIds.has(vehicleId)
    try {
      if (has) {
        await api.del(`/api/me/vehicle-interests/${vehicleId}`)
      } else {
        await api.post('/api/me/vehicle-interests', { vehicleModelId: vehicleId })
      }
      setInterestIds((prev) => {
        const next = new Set(prev)
        has ? next.delete(vehicleId) : next.add(vehicleId)
        return next
      })
    } catch (err) {
      setInterestMessage(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      {loading && <p className="text-ridefit-text-secondary">불러오는 중...</p>}
      {error && <p className="mb-4 text-red-400">에러: {error}</p>}

      {/* 소개 */}
      {!loading && step === -1 && total > 0 && (
        <section className="rounded-2xl border border-ridefit-border bg-ridefit-card px-6 py-12 text-center sm:px-12">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-ridefit-primary">RIDING TYPE FINDER</p>
          <h1 className="text-3xl font-bold text-ridefit-text sm:text-4xl">성향으로 알아보는 나의 오토바이</h1>
          <p className="mx-auto mt-4 max-w-xl text-ridefit-text-secondary">
            질문 {total}개에 답하면 나의 라이딩 성향을 분석하고, RIDEFIT에 등록된 차량 중에서 잘 맞는 차량을 추천해 드려요.
            로그인 없이 1~2분이면 끝나요.
          </p>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="mt-8 rounded-lg bg-ridefit-primary px-8 py-3 font-semibold text-white transition hover:brightness-110"
          >
            시작하기
          </button>
        </section>
      )}

      {/* 질문 */}
      {current && (
        <section>
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-ridefit-text-secondary">
              <span>
                질문 {step + 1} / {total}
              </span>
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="hover:text-ridefit-primary">
                  ← 이전 질문
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ridefit-border" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}>
              <div className="h-full rounded-full bg-ridefit-primary transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ridefit-text">{current.text}</h2>
          <p className="mt-2 text-sm text-ridefit-text-secondary">{current.hint}</p>

          <div className="mt-8 flex flex-col gap-3">
            {current.options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={submitting}
                onClick={() => choose(option.id)}
                className={`rounded-xl border px-5 py-4 text-left text-ridefit-text transition hover:border-ridefit-primary hover:bg-ridefit-primary/10 disabled:opacity-50 ${
                  answers[current.id] === option.id ? 'border-ridefit-primary bg-ridefit-primary/10' : 'border-ridefit-border bg-ridefit-card'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {submitting && <p className="mt-6 text-sm text-ridefit-text-secondary">결과를 분석하고 있어요...</p>}
        </section>
      )}

      {/* 결과 */}
      {result && step === total && (
        <section className="flex flex-col gap-10">
          <div className="rounded-2xl border border-ridefit-primary/40 bg-ridefit-card px-6 py-8 sm:px-10">
            <p className="font-mono text-xs uppercase tracking-widest text-ridefit-primary">나의 라이딩 성향</p>
            <h1 className="mt-2 text-3xl font-bold text-ridefit-text">{result.riderType.name}</h1>
            <p className="mt-1 text-ridefit-primary">{result.riderType.tagline}</p>
            {result.riderType.secondaryLabel && (
              <p className="mt-3 inline-block rounded-full border border-ridefit-border px-3 py-1 text-xs text-ridefit-text-secondary">
                + {result.riderType.secondaryLabel} 성향도 강해요
              </p>
            )}
            <p className="mt-4 text-ridefit-text-secondary">{result.riderType.description}</p>

            <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {result.traits.map((trait) => (
                <li key={trait.trait} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-ridefit-text-secondary">{trait.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ridefit-border" aria-hidden="true">
                    <span className="block h-full rounded-full bg-ridefit-primary" style={{ width: `${trait.percent}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-ridefit-text">{trait.percent}%</span>
                </li>
              ))}
            </ul>

            {result.riderType.tips.length > 0 && (
              <ul className="mt-6 flex flex-col gap-1.5 border-t border-ridefit-border pt-5 text-sm text-ridefit-text-secondary">
                {result.riderType.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="text-ridefit-primary" aria-hidden="true">
                      ▸
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-ridefit-text">나와 잘 맞는 차량</h2>
            <p className="mt-1 text-sm text-ridefit-text-secondary">
              RIDEFIT에 등록된 {result.candidateCount}개 차량과 내 성향을 비교한 결과예요.
            </p>
            {interestMessage && <p className="mt-2 text-sm text-red-400">{interestMessage}</p>}

            <div className="mt-5 flex flex-col gap-5">
              {result.recommendations.map((rec, index) => (
                <article key={rec.vehicle.id} className="overflow-hidden rounded-2xl border border-ridefit-border bg-ridefit-card">
                  <div className="grid md:grid-cols-[16rem_1fr]">
                    <Link to={`/vehicles/${rec.vehicle.id}`} className="relative block bg-ridefit-bg">
                      <VehicleImage vehicle={rec.vehicle} className="h-48 w-full md:h-full" />
                      <span className="absolute left-3 top-3 rounded-full bg-ridefit-bg/80 px-2.5 py-1 font-mono text-xs text-ridefit-text backdrop-blur">
                        {index + 1}위
                      </span>
                    </Link>

                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-ridefit-primary">{rec.vehicle.manufacturerName}</p>
                          <h3 className="text-xl font-bold text-ridefit-text">{rec.vehicle.name}</h3>
                          <p className="mt-1 text-xs text-ridefit-text-secondary">
                            {[rec.vehicle.bodyStyle, rec.vehicle.displacementCc && `${rec.vehicle.displacementCc}cc`, rec.vehicle.priceTierLabel]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-ridefit-primary">{rec.matchPercent}%</p>
                          <p className="text-xs text-ridefit-text-secondary">성향 일치도</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-1 text-sm font-semibold text-ridefit-text">추천 이유</h4>
                        <ul className="flex flex-col gap-1 text-sm text-ridefit-text-secondary">
                          {rec.reasons.map((r) => (
                            <li key={r} className="flex gap-2">
                              <span className="text-ridefit-primary" aria-hidden="true">
                                ✓
                              </span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {rec.pros.length > 0 && (
                          <div>
                            <h4 className="mb-1 text-sm font-semibold text-ridefit-text">장점</h4>
                            <ul className="flex flex-col gap-1 text-sm text-ridefit-text-secondary">
                              {rec.pros.slice(0, 3).map((p) => (
                                <li key={p}>· {p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {rec.cautions.length > 0 && (
                          <div>
                            <h4 className="mb-1 text-sm font-semibold text-ridefit-text">고려할 점</h4>
                            <ul className="flex flex-col gap-1 text-sm text-ridefit-text-secondary">
                              {rec.cautions.slice(0, 3).map((c) => (
                                <li key={c}>· {c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {rec.similar.length > 0 && (
                        <p className="text-sm text-ridefit-text-secondary">
                          <span className="font-semibold text-ridefit-text">비슷한 차량</span>{' '}
                          {rec.similar.map((s, i) => (
                            <span key={s.vehicle.id}>
                              {i > 0 && ', '}
                              <Link to={`/vehicles/${s.vehicle.id}`} className="text-ridefit-primary hover:underline">
                                {s.vehicle.name}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}

                      <div className="mt-auto flex flex-wrap gap-2">
                        <Link
                          to={`/vehicles/${rec.vehicle.id}`}
                          className="rounded-lg bg-ridefit-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                        >
                          자세히 · 내 차고에 추가
                        </Link>
                        {isAuthenticated ? (
                          <button
                            type="button"
                            onClick={() => toggleInterest(rec.vehicle.id)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                              interestIds.has(rec.vehicle.id)
                                ? 'border-ridefit-primary bg-ridefit-primary/15 text-ridefit-primary'
                                : 'border-ridefit-border text-ridefit-text-secondary hover:border-ridefit-primary hover:text-ridefit-primary'
                            }`}
                          >
                            {interestIds.has(rec.vehicle.id) ? '♥ 관심 차량' : '♡ 관심 차량 등록'}
                          </button>
                        ) : (
                          <Link
                            to="/login"
                            className="rounded-lg border border-ridefit-border px-4 py-2 text-sm text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
                          >
                            로그인하고 관심 차량 등록
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-4 text-xs text-ridefit-text-secondary">
              차량 성향 점수는 RIDEFIT이 정한 상대 비교 값(개발용 초기 데이터)이에요. 실제 구매 전에는 시승과 제조사 정보를 꼭 확인하세요.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={restart}
              className="rounded-lg border border-ridefit-border px-5 py-2.5 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
            >
              다시 해보기
            </button>
            <Link
              to="/vehicles"
              className="rounded-lg border border-ridefit-border px-5 py-2.5 text-sm font-medium text-ridefit-text-secondary transition hover:border-ridefit-primary hover:text-ridefit-primary"
            >
              전체 차량 둘러보기
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

export default Finder
