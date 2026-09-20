import { TRAITS } from '../constants/traits'

// 차량의 성향 점수(1~5)를 막대로 보여준다. "RIDEFIT 편집 점수"이지 공식/실측 수치가 아니라는 점을 화면에 밝힌다.
function TraitBars({ scores, compact = false, showNote = true }) {
  if (!scores) return null
  return (
    <div>
      <ul className={`grid gap-x-6 gap-y-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        {TRAITS.map((trait) => {
          const score = scores[trait.key] ?? 0
          return (
            <li key={trait.key} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-ridefit-text-secondary">{trait.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ridefit-border" aria-hidden="true">
                <span className="block h-full rounded-full bg-ridefit-primary" style={{ width: `${(score / 5) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-xs text-ridefit-text">{score}/5</span>
            </li>
          )
        })}
      </ul>
      {showNote && (
        <p className="mt-3 text-xs text-ridefit-text-secondary">
          성향 점수는 RIDEFIT이 정한 상대 비교 값(개발용 초기 데이터)이며 제조사 공식 수치가 아니에요.
        </p>
      )}
    </div>
  )
}

export default TraitBars
