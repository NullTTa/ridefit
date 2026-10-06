import { GUIDE_DEFAULT_ICON, GUIDE_TYPE_ICON } from './Icon'

// 가이드 글 아이콘: DB의 article.emoji 대신 글 유형(PART/CONSUMABLE/DIY)별 Lucide 아이콘을 쓴다.
function GuideIcon({ type, className = '' }) {
  const Component = GUIDE_TYPE_ICON[type] ?? GUIDE_DEFAULT_ICON
  return <Component aria-hidden="true" strokeWidth={1.75} className={className} />
}

export default GuideIcon
